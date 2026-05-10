import { MailCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

export default function CheckEmailPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center">
            <MailCheck size={26} className="text-brand-light" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Check your email</h1>
            <p className="text-sm text-zinc-400 mt-2">
              Your JobBinder sign-in link is on the way. Open it on this device to continue.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
