import { BackLink } from "@/components/nav/BackLink";
import { NewProposalForm } from "@/components/proposals/NewProposalForm";

// Fallback per navigazione diretta/hard-nav: la creazione normale avviene
// nell'overlay @modal/(.)proposals/new.
export default function NewProposalPage() {
  return (
    <main className="flex flex-1 justify-center p-6">
      <div className="flex w-full max-w-lg flex-col gap-4">
        <BackLink />
        <NewProposalForm />
      </div>
    </main>
  );
}
