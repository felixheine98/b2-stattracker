import type { ReactNode } from "react"

/** A shared presentation of recorded results. Scores and their meaning come from the caller. */
export function ResultBoard({ team, opponent, teamLogo, opponentLogo, score, detail, context }: {
  team: string
  opponent: string
  teamLogo?: ReactNode
  opponentLogo?: ReactNode
  score: ReactNode
  detail: ReactNode
  context?: ReactNode
}) {
  return (
    <div className="result-board">
      <div className="result-board-team">
        <div className="result-board-identity">
          {teamLogo && <span className="result-board-logo">{teamLogo}</span>}
          <div className="min-w-0">
            {team}
            {context && <span className="result-board-detail">{context}</span>}
          </div>
        </div>
      </div>
      <div className="result-board-score">
        {score}
        <span className="result-board-detail">{detail}</span>
      </div>
      <div className="result-board-team">
        <div className="result-board-identity">
          {opponentLogo && <span className="result-board-logo">{opponentLogo}</span>}
          <div className="min-w-0">{opponent}</div>
        </div>
      </div>
    </div>
  )
}
