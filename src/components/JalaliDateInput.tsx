'use client';
import { useState, type InputHTMLAttributes, type ChangeEvent } from 'react';
import { jalaliInputToISO, toJalaliString } from '@/lib/jalali';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'type'> & { value?: string };
/** Civil ISO date in application state; Persian calendar text at the input boundary. */
export default function JalaliDateInput({value = '', onChange, min, max, ...props}: Props) {
  const [draft, setDraft] = useState<{iso: string; text: string} | null>(null);
  const formatted = value ? toJalaliString(value).replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : '';
  function change(event: ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    setDraft({iso:value,text});
    try {
      if (!text && props.required) {
        event.target.setCustomValidity('تاریخ را وارد کنید.');
        return;
      }
      const iso = text ? jalaliInputToISO(text) : '';
      if (iso && ((min && iso < String(min)) || (max && iso > String(max)))) throw new Error('تاریخ خارج از بازه مجاز است.');
      event.target.setCustomValidity('');
      setDraft({iso,text});
      onChange?.({...event, target: {...event.target,value:iso}, currentTarget: {...event.currentTarget,value:iso}});
    } catch (error) { event.target.setCustomValidity((error as Error).message); }
  }
  return <input {...props} type="text" inputMode="numeric" dir="ltr" placeholder="۱۴۰۵/۰۸/۰۲" aria-label={props['aria-label']} value={draft?.iso === value ? draft.text : formatted} onChange={change}/>;
}
