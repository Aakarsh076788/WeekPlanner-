import Tracker from './tracker';
import {getChatGPTUser,chatGPTSignInPath} from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Home(){const user=await getChatGPTUser();return <Tracker signedIn={!!user} signInPath={chatGPTSignInPath('/')} initialInstant={new Date().toISOString()} />}
