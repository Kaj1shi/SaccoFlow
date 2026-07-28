import { useState } from 'react'
import { Check, Dot, Eye, EyeOff } from 'lucide-react'
import { PASSWORD_RULES } from '../lib/password'

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="mt-2 space-y-1">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password)
        return (
          <li
            key={rule.id}
            className={`flex items-center gap-1.5 text-xs font-medium ${
              ok ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {ok ? <Check className="h-3.5 w-3.5" /> : <Dot className="h-3.5 w-3.5" />}
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  showChecklist = false,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  showChecklist?: boolean
  placeholder?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="input pr-11"
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showChecklist && <PasswordChecklist password={value} />}
    </div>
  )
}
