import type { ReactNode } from "react"

/** A shared presentation of recorded results. Scores and their meaning come from the caller. */
export function ResultBoard({ team, opponent, score, detail, context }: {
  team: string
  opponent: string
  score: ReactNode
  detail: ReactNode
  context?: ReactNode
}) {
  return (
    <div className="result-board">
      <div className="result-board-team">
        {team}
        {context && <span className="result-board-detail">{context}</span>}
      </div>
      <div className="result-board-score">
        {score}
        <span className="result-board-detail">{detail}</span>
      </div>
      <div className="result-board-team">{opponent}</div>
    </div>
  )
}
