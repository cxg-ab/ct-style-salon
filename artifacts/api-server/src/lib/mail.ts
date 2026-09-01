import { logger } from "./logger";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(message: MailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return false;
  }

  const from = process.env.RESEND_FROM || "CT Style Salon <bookings@ctstylesalon.ae>";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html ?? message.text.replaceAll("\n", "<br />"),
      }),
    });
    if (!response.ok) {
      logger.warn({ status: response.status }, "Confirmation email was not accepted");
      return false;
    }
    return true;
  } catch (error) {
    logger.warn({ error }, "Confirmation email failed to send");
    return false;
  }
}

export function confirmationMail(input: {
  customerName: string;
  email: string;
  date: string;
  time: string;
  stylistName: string;
  serviceNames: string[];
  lookupCode: string;
}): MailMessage {
  const services = input.serviceNames.join(", ");
  const text = [
    `Hello ${input.customerName},`,
    "",
    `Your visit at CT Style Salon is booked.`,
    `${services}`,
    `With ${input.stylistName} on ${input.date} at ${input.time}.`,
    "",
    `Your booking reference is ${input.lookupCode}.`,
    "Use this code with your email on the Your appointments page to view, move, or cancel.",
    "",
    "My City Centre Masdar, Abu Dhabi",
    "+971 2 552 0422",
  ].join("\n");

  return {
    to: input.email,
    subject: `CT Style Salon · ${input.lookupCode} · ${input.date} ${input.time}`,
    text,
  };
}
