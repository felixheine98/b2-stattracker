import { formatDay } from "@/lib/player-status"
import { stageDate, stageName, type StageRef } from "@/lib/stages"

interface Props {
  stage: StageRef
  // All stages of the tournament
  stages: StageRef[]
  startDate: Date | string
}

// Heading of a stage in a match list: its name and the day it is played
export function StageHeading({ stage, stages, startDate }: Props) {
  return (
    <h3 className="mb-2 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wider text-[#c5bfbf]">
      {stageName(stage, stages)}
      <span className="font-normal normal-case tracking-normal text-[#5e5858]">
        {formatDay(stageDate(stage, stages, new Date(startDate)))}
      </span>
    </h3>
  )
}
