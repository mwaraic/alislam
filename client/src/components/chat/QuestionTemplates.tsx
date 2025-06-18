import { BookOpen } from 'lucide-react'

interface QuestionTemplatesProps {
  setQuestion: (question: string) => void
  setSelectedIndex: (index: string) => void
  indexOptions: Array<{ value: string; label: string; description: string }>
}

const templateQuestions = {
  'ruhani-khazain': [
    'What is the significance of the Promised Messiah in Islamic eschatology?'
  ],
  'fiqh-ul-ahmadiyya': [
    'What are the specific rulings for Ahmadi Muslims regarding prayer?'
  ],
  'fiqh-ul-masih': [
    'حضرت مسیح موعود علیہ الصلوٰۃ والسلام نے بدعات (نئی رسومات) کے خلاف کون سا موقف اختیار فرمایا؟'
  ]
}

export function QuestionTemplates({
  setQuestion,
  setSelectedIndex,
  indexOptions
}: QuestionTemplatesProps) {
  const handleTemplateClick = (question: string, bookValue: string) => {
    setQuestion(question)
    setSelectedIndex(bookValue)
  }

  return (
    <div className="p-6 border border-border rounded-lg bg-card/50 mb-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {indexOptions
          .filter((option) => templateQuestions[option.value as keyof typeof templateQuestions])
          .map((option) => {
          const questions = templateQuestions[option.value as keyof typeof templateQuestions] || []
          
          return (
            <div key={option.value} className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-sm text-foreground">{option.label}</h4>
              </div>
              
              <div className="space-y-2">
                {questions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleTemplateClick(question, option.value)}
                    className="w-full text-left p-3 text-xs bg-muted/50 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
} 