type ProgressBarProps = {
  progress: number
}

function ProgressBar({ progress = 0 }: ProgressBarProps) {
  const progressStyle = {
    width: `${progress}%`
  }

  return (
    <div className="w-full h-3 mt-4 rounded-xl bg-zinc-700">
      <div
        role="progressbar"
        aria-label="Progresso de hábitos completados nesse dia"
        aria-valuenow={progress}
        className="h-3 rounded-xl bg-violet-600"
        style={progressStyle}></div>
    </div>
  )
}

export default ProgressBar
