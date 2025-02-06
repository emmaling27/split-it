import { ActionCtx } from "./_generated/server";
import { Resend } from "resend";

type EmailArgs = {
  to: string;
  subject: string;
  html: string;
};

export async function sendResend(
  ctx: ActionCtx,
  { to, subject, html }: EmailArgs,
) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const data = await resend.emails.send({
      from: "Split-it <no-reply@updates.listsoflists.app>",
      to,
      subject,
      html,
    });

    return data;
  } catch (error) {
    throw new Error(`Failed to send email: ${error}`);
  }
}
