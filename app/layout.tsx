import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Weekcraft · Today, made simple',description:'Your private BTech routine: today’s work and checklist, weekly planning, separate metrics, and direct in-site planning.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
