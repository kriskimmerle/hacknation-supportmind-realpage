import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatClient } from "@/components/app/chat-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function ChatPage() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>SupportMind Agent Chat</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This is an agentic interface (not a live agent copilot UI) to explore the KB, scripts, and prior ticket
          resolutions. The assistant answers with citations and never invents IDs.
        </CardContent>
      </Card>
      <ChatClient />
    </div>
  );
}
