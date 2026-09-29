import { MentorChat } from '../components/MentorChat'
import { PageHeader } from '../components/ui'

export default function Mentor() {
  return (
    <>
      <PageHeader title="FinMentor" subtitle="Ask about your money in plain language. Answers use your own numbers." />
      <div className="h-[calc(100vh-15rem)] min-h-[420px] rounded-xl border border-gray-200 bg-gray-50 p-4 lg:h-[calc(100vh-12rem)]">
        <MentorChat />
      </div>
    </>
  )
}
