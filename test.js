const express = require("express");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const fs = require("fs");
const { Queue, Worker, QueueEvents } = require("bullmq");
const bodyParser = require("body-parser");
const Redis = require("ioredis");
const { HfInference } = require("@huggingface/inference");
const cron = require("node-cron");

const app = express();
const port = 3000;

app.use(bodyParser.json());

const hf = new HfInference("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");

// Load OAuth2 credentials and tokens
let credentials;
try {
  const credentialsRaw = fs.readFileSync("credentials.json");
  credentials = JSON.parse(credentialsRaw);
  console.log("Credentials loaded successfully:", credentials);
} catch (error) {
  console.error("Error reading credentials.json:", error);
  process.exit(1);
}

// Create OAuth2 client
let oAuth2Client;

try {
  oAuth2Client = new google.auth.OAuth2(
    credentials.web.client_id,
    credentials.web.client_secret,
    credentials.web.redirect_uris[0]
  );
  console.log("OAuth2 client created successfully");
} catch (error) {
  console.error("Error creating OAuth2 client:", error);
  process.exit(1);
}

// Get authorization URL
app.get("/auth/google", (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://mail.google.com",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  });
  res.redirect(authUrl);
});

// Get tokens after OAuth2
app.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync("token.json", JSON.stringify(tokens));
    res.send("Authorization successful");
  } catch (error) {
    console.error("Error retrieving access token", error);
    res.send("Error retrieving access token");
  }
});

// Setup email transporter using OAuth2 for Gmail
function createGmailTransporter() {
  try {
    const token = JSON.parse(fs.readFileSync("token.json"));
    oAuth2Client.setCredentials(token);

    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: "mishrakaushalkant687@gmail.com",
        clientId: credentials.web.client_id,
        clientSecret: credentials.web.client_secret,
        refreshToken: token.refresh_token,
        accessToken: token.access_token,
      },
    });
  } catch (error) {
    console.error("Error creating Gmail transporter:", error);
    throw error;
  }
}

// Function to categorize email content using Hugging Face API
async function categorizeEmailContent(emailContent) {
  try {
    const response = await hf.textClassification({
      model: "distilbert-base-uncased-finetuned-sst-2-english",
      inputs: emailContent,
    });
    const categories = {
      POSITIVE: "Interested",
      NEGATIVE: "NotInterested",
      NEUTRAL: "MoreInformation",
    };
    return categories[response[0].label] || "MoreInformation";
  } catch (error) {
    console.error(
      "Error categorizing email content using Hugging Face API:",
      error
    );
    throw error;
  }
}

// Function to generate email response using Hugging Face API
async function generateEmailResponse(emailContent, category) {
  let prompt;
  switch (category) {
    case "Interested":
      prompt = `Generate a professional email response suggesting a demo call for the following email content:\n\n${emailContent}`;
      break;
    case "NotInterested":
      prompt = `Generate a professional email response acknowledging the disinterest for the following email content:\n\n${emailContent}`;
      break;
    case "MoreInformation":
      prompt = `Generate a professional email response providing more information for the following email content:\n\n${emailContent}`;
      break;
    default:
      prompt = `Generate a professional email response for the following email content:\n\n${emailContent}`;
  }
  try {
    const response = await hf.textGeneration({
      model: "gpt2",
      inputs: prompt,
      parameters: { max_length: 150, temperature: 0.7 },
    });
    return response.generated_text.trim();
  } catch (error) {
    console.error(
      "Error generating email response using Hugging Face API:",
      error
    );
    throw error;
  }
}

// Function to send email
async function sendEmail(transporter, to, subject, body) {
  try {
    const mailOptions = {
      from: "mishrakaushalkant687@gmail.com",
      to: to,
      subject: subject,
      html: body,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

// Function to fetch new emails
async function fetchNewEmails() {
  try {
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    const res = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
    });

    const messages = res.data.messages || [];

    for (const message of messages) {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
      });

      const emailContent = msg.data.snippet;
      const senderEmail = msg.data.payload.headers.find(
        (header) => header.name === "From"
      ).value;

      await queue.add("process-email", {
        content: emailContent,
        recipient: senderEmail,
        messageId: message.id,
      });
    }
  } catch (error) {
    console.error("Error fetching new emails:", error);
  }
}

// Redis connection
const connection = new Redis({
  maxRetriesPerRequest: null,
});

// Create a Queue instance for email processing
const queue = new Queue("email-processing", { connection });

// Create a QueueEvents instance to handle queue events
const queueEvents = new QueueEvents("email-processing", { connection });

queueEvents.on("completed", ({ jobId }) => {
  console.log(`Job ${jobId} has been completed`);
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.log(`Job ${jobId} has failed with reason ${failedReason}`);
});

// Add a task to the queue
app.post("/process-email", async (req, res) => {
  const { emailContent, recipientEmail } = req.body;

  try {
    await queue.add("process-email", {
      content: emailContent,
      recipient: recipientEmail,
    });
    res.send("Email task added to the queue.");
  } catch (error) {
    console.error("Error adding task to queue", error);
    res.status(500).send("Error adding task to queue");
  }
});

// Worker to process email tasks
const worker = new Worker(
  "email-processing",
  async (job) => {
    const emailContent = job.data.content;
    const recipientEmail = job.data.recipient;
    const messageId = job.data.messageId;

    try {
      const category = await categorizeEmailContent(emailContent);
      console.log(`Email categorized as: ${category}`);

      const response = await generateEmailResponse(emailContent, category);
      let subject = "Thank you for connecting with us";
      let body = response;

      const transporter = createGmailTransporter();
      await sendEmail(transporter, recipientEmail, subject, body);
      console.log(`Processed email for recipient: ${recipientEmail}`);

      // Assign label to the email
      const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
      const labelId = await getLabelId(gmail, category);
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        resource: {
          addLabelIds: [labelId],
          removeLabelIds: ["UNREAD"],
        },
      });
      console.log(`Label "${category}" assigned to email`);
    } catch (error) {
      console.error("Error processing email task", error);
    }
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`Job completed with result ${job.returnvalue}`);
});

worker.on("failed", (job, err) => {
  console.log(`Job failed with error ${err.message}`);
});

// Function to get or create a label in Gmail
async function getLabelId(gmail, labelName) {
  try {
    const res = await gmail.users.labels.list({ userId: "me" });
    const labels = res.data.labels;
    const label = labels.find((label) => label.name === labelName);
    if (label) {
      return label.id;
    } else {
      const newLabel = await gmail.users.labels.create({
        userId: "me",
        resource: {
          name: labelName,
        },
      });
      return newLabel.data.id;
    }
  } catch (error) {
    console.error("Error getting or creating label:", error);
    throw error;
  }
}

// Schedule email fetching
cron.schedule("* * * * *", fetchNewEmails);

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
