import { useState } from 'react'
import DebugPage from './debug/DebugPage'

export default function App() {
    const [view, setView] = useState<'home' | 'debug'>('home')

    if (view === 'debug') {
        return <DebugPage onBack={() => setView('home')} />
    }

    return (
        <div>
            <h1>Hello Extension</h1>
            <button onClick={() => setView('debug')}>Debug</button>
        </div>
    )
}
