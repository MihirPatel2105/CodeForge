import Link from "next/link";
import { ArrowUpRight, Check, Code2, ShieldCheck } from "lucide-react";

export function AuthEntryProof({ variant = "product" }: { variant?: "product" | "recovery" | "security" }) {
  const recovery = variant === "recovery";
  const security = variant === "security";
  return (
    <aside className="pa-story" aria-label={recovery ? "Account recovery" : security ? "Account security" : "Your CodeForge workspace"}>
      <div className="pa-story-copy">
        <p className="pa-story-intro">{recovery ? "A fresh start." : security ? "Your account. Your control." : "A little idea. A lot of possibility."}</p>
        <h2>{recovery ? <>Let’s get<br />you back in.</> : security ? <>Keep your<br />workspace yours.</> : <>Your next idea<br />starts here.</>}</h2>
        <p className="pa-story-lead">{recovery ? "Recover access, choose a new password, and get back to building." : security ? "Review your account activity and take the next step with confidence." : "Five agents turn your request into an API. You guide the plan. They take care of the build."}</p>
      </div>
      {recovery || security ? (
        <div className="pa-security-note"><ShieldCheck size={28} strokeWidth={1.5} aria-hidden /><h3>{recovery ? "A clear path back." : "Stay in the loop."}</h3><p>{recovery ? "Reset links expire after 10 minutes and work once. Resetting your password removes existing sessions and passkeys." : "Confirm a sign-in you recognize, or end your sessions and reset your password if it wasn’t you."}</p></div>
      ) : (
        <div className="pa-build">
          <div className="pa-build-heading"><Code2 size={19} aria-hidden /><span>A glimpse of your workspace</span></div>
          <p className="pa-example-prompt">“Build an API for my personal library.”</p>
          <ol className="pa-build-steps"><li><Check size={15} aria-hidden /><span>Requirements approved</span><span>PM</span></li><li><Check size={15} aria-hidden /><span>API designed</span><span>Architect</span></li><li><Check size={15} aria-hidden /><span>Code reviewed and tested</span><span>Team</span></li></ol>
          <div className="pa-build-bottom"><span>Library example</span><Link href="/demo/library">Explore the demo<ArrowUpRight size={16} aria-hidden /></Link></div>
        </div>
      )}
    </aside>
  );
}
