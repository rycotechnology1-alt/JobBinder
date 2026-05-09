import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import prisma from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email, phone, role, companyId } = await req.json();

    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
    }

    if (!email && !phone) {
      return NextResponse.json({ error: "Must provide either email or phone" }, { status: 400 });
    }

    // Determine plan to enforce limits
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { _count: { select: { users: true } } },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (company.plan === "FREE" && company._count.users >= 1) {
      return NextResponse.json(
        { error: "Free plan is limited to 1 user. Please upgrade to invite team members." },
        { status: 403 }
      );
    }

    // In a real app, generate a secure token here and save an Invite record
    const inviteLink = `https://jobbinder.app/invite?companyId=${companyId}&role=${role}`;

    // Send email using Resend
    if (email) {
      const { data, error } = await resend.emails.send({
        from: "JobBinder <invites@jobbinder.app>",
        to: [email],
        subject: `You've been invited to join ${company.name} on JobBinder`,
        html: `
          <div>
            <h2>Join your crew on JobBinder</h2>
            <p>You have been invited to join <strong>${company.name}</strong>.</p>
            <p>Click the link below to set up your account and access the shared job folders:</p>
            <a href="${inviteLink}" style="display:inline-block;padding:12px 24px;background:#0070f3;color:white;text-decoration:none;border-radius:4px;">
              Accept Invitation
            </a>
          </div>
        `,
      });

      if (error) {
        console.error("Resend error:", error);
        return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
      }
    }

    // Note: SMS would be handled via Twilio/SNS here if phone was provided instead

    return NextResponse.json({
      success: true,
      message: email ? "Invite email sent" : "SMS capability required",
      inviteLink // Returned for testing purposes
    });

  } catch (error) {
    console.error("Error sending invite:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
