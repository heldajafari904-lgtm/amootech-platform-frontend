"use client";
import ExamBasketBuilder from '@/components/exams/ExamBasketBuilder';
import type {StudentExam} from './studentExam';
export default function ReportTopicBuilder(props:{token:string;onCreated?:(exam:StudentExam)=>void;onBusyChange?:(busy:boolean)=>void}) {
 return <ExamBasketBuilder<StudentExam> {...props} mode="report"/>;
}
