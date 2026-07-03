import { NewProposalForm } from "@/components/proposals/NewProposalForm";

// Fallback per navigazione diretta/hard-nav: la creazione normale avviene
// nell'overlay @modal/(.)proposals/new.
export default function NewProposalPage() {
  return (
    <main className="flex flex-1 justify-center p-6">
      <div className="w-full max-w-lg">
        <NewProposalForm />
      </div>
    </main>
  );
}
