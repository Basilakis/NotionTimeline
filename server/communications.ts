import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import twilio from "twilio";

// AWS SES Email Service
export class EmailService {
  private sesClient: SESClient;

  constructor() {
    this.sesClient = new SESClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
      }
    });
  }

  async sendEmail(to: string, subject: string, htmlBody: string, textBody?: string): Promise<boolean> {
    try {
      const params = {
        Source: process.env.FROM_EMAIL || "noreply@your-domain.com",
        Destination: {
          ToAddresses: [to]
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: "UTF-8"
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: "UTF-8"
            },
            Text: {
              Data: textBody || htmlBody.replace(/<[^>]*>/g, ''),
              Charset: "UTF-8"
            }
          }
        }
      };

      const command = new SendEmailCommand(params);
      await this.sesClient.send(command);
      return true;
    } catch (error) {
      console.error("Error sending email:", error);
      return false;
    }
  }
}

// Twilio SMS Service
export class SMSService {
  private twilioClient: twilio.Twilio | null = null;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (accountSid && authToken) {
      this.twilioClient = twilio(accountSid, authToken);
    }
  }

  async sendSMS(to: string, message: string): Promise<boolean> {
    if (!this.twilioClient) {
      console.error("Twilio client not initialized. Please check your credentials.");
      return false;
    }

    try {
      await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER || "",
        to: to
      });
      return true;
    } catch (error) {
      console.error("Error sending SMS:", error);
      return false;
    }
  }
}

export const emailService = new EmailService();
export const smsService = new SMSService();