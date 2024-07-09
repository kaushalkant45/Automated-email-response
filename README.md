# Email Processing and Response Automation Tool

## Overview

This project is an automated email processing and response tool built using Node.js, Express.js, Google OAuth2, Hugging Face API, BullMQ, and Redis. The tool fetches unread emails from Gmail, categorizes the email content, generates appropriate responses, and sends the responses back to the sender. Additionally, the emails are labeled based on their content.

## Prerequisites

- Node.js
- npm
- Google API credentials
- Hugging Face API token
- Redis

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/kaushalkant45/Automated-email-response.git
   cd email-response-tool
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up Google API credentials:

   - Create a project on the [Google Cloud Console](https://console.cloud.google.com/).
   - Enable the Gmail API.
   - Download the OAuth2 credentials file and save it as `credentials.json` in the root directory of your project.

4. Set up Hugging Face API:

   - Obtain an API token from [Hugging Face](https://huggingface.co/).
   - Replace `"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"` with your API token in the `test.js` file.

5. Set up Redis:
   - Ensure you have Redis installed and running on your machine.

## Configuration

1. **Google API Configuration**:

   - The `credentials.json` file contains the OAuth2 credentials for accessing the Gmail API.
   - Example `credentials.json` file:

     ```json
     {
       "web": {
         "client_id": "your-client-id",
         "project_id": "your-project-id",
         "auth_uri": "https://accounts.google.com/o/oauth2/auth",
         "token_uri": "https://oauth2.googleapis.com/token",
         "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
         "client_secret": "your-client-secret",
         "redirect_uris": [
           "http://localhost:3000/oauth2callback",
           "https://developers.google.com/oauthplayground",
           "http://localhost"
         ],
         "javascript_origins": ["http://localhost:3000"]
       },
       "microsoft": {
         "client_id": "your-microsoft-client-id",
         "tenant_id": "your-tenant-id",
         "client_secret": "your-microsoft-client-secret",
         "redirect_uri": [
           "http://localhost:3000/oauth2callback/outlook",
           "http://localhost:3000"
         ],
         "authority": "https://login.microsoftonline.com/common"
       }
     }
     ```

2. **Environment Variables**:
   - You may configure your environment variables in a `.env` file.

## Outlook OAuth Access

Currently, Outlook OAuth access has not been implemented in this project due to issues encountered during the admin consent permission process.

If you intend to integrate Outlook OAuth access, ensure you have the necessary permissions and follow the steps below:

1. Obtain a Microsoft Azure application client ID and client secret.
2. Configure the redirect URIs for your application.
3. Update the `credentials.json` file with your Microsoft application details.
4. Implement the necessary endpoints and logic in the project to handle Outlook OAuth authentication and token management.

For assistance with obtaining admin consent and setting up permissions, refer to the [Microsoft Azure documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-admin-consent).

If you encounter issues during the admin consent permission process, ensure that your Microsoft Azure application is configured correctly with the required permissions.

## Usage

1. **Start the Server**:

   - Run the server:

     ```bash
     npm start
     ```

   - The server will start on `http://localhost:3000`.

2. **Authenticate with Google**:

   - Open your browser and navigate to `http://localhost:3000/auth/google` to authenticate with your Google account.
   - Follow the prompts to grant access to the Gmail API.
   - The access token will be saved in `token.json`.

3. **Processing Emails**:
   - The tool fetches new unread emails every minute using a cron job.
   - The fetched emails are categorized using the Hugging Face API.
   - An appropriate response is generated and sent to the sender using the Gmail API.
   - The email is labeled based on the categorized content.

## API Endpoints

- **GET `/auth/google`**:

  - Redirects to the Google OAuth2 authorization URL.

- **GET `/oauth2callback`**:

  - Handles the OAuth2 callback and stores the access token.

- **POST `/process-email`**:

  - Adds an email processing task to the queue.
  - Example request body:

    ```json
    {
      "emailContent": "Your email content here",
      "recipientEmail": "recipient@example.com"
    }
    ```

## Project Structure

- `test.js`: Main server file containing the logic for email processing and response generation.
- `credentials.json`: File containing OAuth2 credentials for Google API.
- `token.json`: File to store the access token after successful OAuth2 authentication.
- `package.json`: Project dependencies and scripts.

## Functions

- **createGmailTransporter**:

  - Creates an OAuth2 authenticated transporter for sending emails using Gmail.

- **categorizeEmailContent**:

  - Uses Hugging Face API to categorize email content.

- **generateEmailResponse**:

  - Generates an email response based on the categorized content using Hugging Face API.

- **sendEmail**:

  - Sends an email using the Gmail transporter.

- **fetchNewEmails**:

  - Fetches unread emails from Gmail and adds them to the processing queue.

- **getLabelId**:

  - Gets or creates a label in Gmail.

- **queue**:

  - BullMQ queue for processing email tasks.

- **worker**:
  - BullMQ worker for processing email tasks.

## Dependencies

- `express`: Web framework for Node.js.
- `googleapis`: Google API client library.
- `nodemailer`: Module for sending emails.
- `fs`: File system module for reading and writing files.
- `bullmq`: Task scheduler for job queues.
- `body-parser`: Middleware for parsing request bodies.
- `ioredis`: Redis client.
- `@huggingface/inference`: Hugging Face API client.
- `node-cron`: Cron job scheduler.

## License

This project is licensed under the MIT License.
