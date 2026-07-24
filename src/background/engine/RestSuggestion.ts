import type { BRIResult } from './types'
import { suggestions } from '../../data/suggestions'
import { triggerBaseline } from '../../data/trigger-baseline'
import { fatigueTitle } from '../../data/fatigue-title'
import type { RestSuggestion } from '../../models/RestSuggestion'
import { formatDuration } from '../../utils/time'

function getRestSuggestion(result: BRIResult) {
    if (result.triggerPath === null) return null

    const base = triggerBaseline[result.triggerPath]
    const page = result.pageType ? suggestions[result.pageType] : null

    return {
        durationMin: page?.durationMin ?? base.durationMin, // number 或 [min,max]
        activities: page?.activities ?? base.coreActivities,
        avoid: page?.avoid ?? base.avoid,
        message: page?.message ?? base.rationale,
        fatigue: base.fatigue,
    }
}

function formatActions(activities: string[], avoid: string[]): string {
    const doList = `试试：${activities.join('、')}`
    const dontList = avoid.length ? `\n别再${avoid.join('、')}` : ''
    return doList + dontList
}

export function buildRestSuggestion(result: BRIResult): RestSuggestion | null {
    const s = getRestSuggestion(result)
    if (!s) return null

    return {
        title: fatigueTitle[s.fatigue] ?? '该休息了',
        duration: formatDuration(s.durationMin),
        body: s.message,
        actions: formatActions(s.activities, s.avoid),
    }
}
