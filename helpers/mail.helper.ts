import nodemailer from "nodemailer";
import { getApiAppPassword } from "../configs/setting.config";

export const sendMail = async (email: string, title: string, content: string) => {
  const apiAppPassword = await getApiAppPassword();

  // Create a transporter object
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: process.env.NODE_ENV === 'production', // true: nếu là https, false: nếu là http
    auth: {
      user: apiAppPassword.gmailUser,
      pass: apiAppPassword.gmailPassword,
    }
  });

  // Configure the mailoptions object
  const mailOptions = {
    from: apiAppPassword.gmailUser,
    to: email,
    subject: title,
    html: content
  };

  // Send the email
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log('Error:', error);
    } else {
      console.log('Email sent: ', info.response);
    }
  });
}