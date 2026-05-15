"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";

type CellState = "visible" | "masked" | "faded" | "blank";
type Pace = "slow" | "medium" | "fast";
type TrainingMode = "classic" | "speedFlash";
type Feedback = "Correct" | "Miss";
type TrainingStatus = "READY" | "RUNNING" | "PAUSED" | "FINISHED";

type Cell = {
  id: number;
  text: string;
  state: CellState;
};

type Board = {
  cells: Cell[];
  targetId: number;
};

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const FLASH_WORDS = ["FOCUS", "SPEED", "VISION", "FLOW", "TRACK"];
const GRID_SIZE = 9;
const ROUND_SECONDS = 30;
const CELL_IDS = Array.from({ length: GRID_SIZE }, (_, idx) => idx + 1);
const PACE_OPTIONS: { label: string; value: Pace; minDelay: number; maxDelay: number }[] = [
  { label: "Slow", value: "slow", minDelay: 1200, maxDelay: 1800 },
  { label: "Medium", value: "medium", minDelay: 500, maxDelay: 1200 },
  { label: "Fast", value: "fast", minDelay: 150, maxDelay: 500 },
];
const INITIAL_CELLS: Cell[] = [
  { id: 1, text: "7", state: "visible" },
  { id: 2, text: "3", state: "masked" },
  { id: 3, text: "9", state: "faded" },
  { id: 4, text: "1", state: "blank" },
  { id: 5, text: "6", state: "visible" },
  { id: 6, text: "4", state: "masked" },
  { id: 7, text: "8", state: "faded" },
  { id: 8, text: "2", state: "blank" },
  { id: 9, text: "5", state: "visible" },
];

function randomDigit(): string {
  return DIGITS[Math.floor(Math.random() * DIGITS.length)];
}

function randomState(): CellState {
  const roll = Math.random();
  if (roll < 0.35) return "visible";
  if (roll < 0.6) return "masked";
  if (roll < 0.8) return "faded";
  return "blank";
}

function createInitialCells(): Cell[] {
  return INITIAL_CELLS.map((cell) => ({ ...cell }));
}

function getInitialTarget(cells: Cell[]): number {
  const firstVisible = cells.find((cell) => cell.state === "visible");
  return firstVisible ? firstVisible.id : cells[0].id;
}

function pickVisibleTarget(cells: Cell[]): number {
  const visibleCells = cells.filter((cell) => cell.state === "visible");
  const pool = visibleCells.length > 0 ? visibleCells : cells;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function createInitialBoard(): Board {
  const cells = createInitialCells();
  return {
    cells,
    // Keep first paint deterministic to avoid hydration mismatch.
    targetId: getInitialTarget(cells),
  };
}

function createNextBoard(prevCells: Cell[]): Board {
  const changeCount = 3 + Math.floor(Math.random() * 3);
  const targetIds = new Set(shuffle(CELL_IDS).slice(0, changeCount));
  const cells = prevCells.map((cell) => {
    if (!targetIds.has(cell.id)) return cell;
    return {
      ...cell,
      text: randomDigit(),
      state: randomState(),
    };
  });

  if (!cells.some((cell) => cell.state === "visible")) {
    const fallbackId = shuffle(CELL_IDS)[0];
    return {
      cells: cells.map((cell) =>
        cell.id === fallbackId ? { ...cell, text: randomDigit(), state: "visible" } : cell,
      ),
      targetId: fallbackId,
    };
  }

  return {
    cells,
    targetId: pickVisibleTarget(cells),
  };
}

function pickFlashWord(): string {
  return FLASH_WORDS[Math.floor(Math.random() * FLASH_WORDS.length)];
}

function createSpeedFlashBoard(targetWord: string): Board {
  const targetId = shuffle(CELL_IDS)[0];
  const pool = FLASH_WORDS.filter((word) => word !== targetWord);

  return {
    targetId,
    cells: CELL_IDS.map((id) => {
      if (id === targetId) {
        return { id, text: targetWord, state: "visible" as const };
      }

      const word = pool[Math.floor(Math.random() * pool.length)];
      return { id, text: word, state: "visible" as const };
    }),
  };
}

function getNextDelay(pace: Pace): number {
  const option = PACE_OPTIONS.find((item) => item.value === pace) ?? PACE_OPTIONS[1];
  return option.minDelay + Math.floor(Math.random() * (option.maxDelay - option.minDelay + 1));
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getCellStyle(state: CellState): string {
  if (state === "visible") {
    return "bg-zinc-900 text-zinc-50 border-zinc-700/80";
  }
  if (state === "masked") {
    return "bg-zinc-900/82 text-transparent border-zinc-700/70 [text-shadow:0_0_8px_rgba(255,255,255,0.28)]";
  }
  if (state === "faded") {
    return "bg-zinc-800/65 text-zinc-200/35 border-zinc-600/70";
  }
  return "bg-zinc-900/25 text-transparent border-zinc-700/50";
}

const infoCardClassName =
  "flex h-[5.25rem] flex-col justify-center rounded-md border border-zinc-800/80 bg-zinc-900/90 px-4 py-3 text-center shadow-[0_1px_0_rgba(255,255,255,0.03),0_12px_28px_rgba(0,0,0,0.28)]";
const infoLabelClassName = "text-[10px] font-semibold tracking-[0.28em] text-zinc-500";
const infoValueClassName = "mt-1 text-[1.05rem] font-semibold tracking-[0.18em] text-zinc-100 sm:text-[1.15rem]";
const infoValueStrongClassName = "mt-1 text-[1.2rem] font-semibold tracking-[0.18em] text-zinc-100 sm:text-[1.3rem]";
const controlButtonClassName =
  "touch-manipulation rounded-md border px-4 py-2 text-sm font-semibold tracking-wide transition duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-45";
const gridCellBaseClassName =
  "touch-manipulation select-none rounded-md border transition duration-200 ease-out";

export default function GamePage() {
  const [board, setBoard] = useState<Board>(() => createInitialBoard());
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<TrainingMode>("classic");
  const [status, setStatus] = useState<TrainingStatus>("READY");
  const [pace, setPace] = useState<Pace>("medium");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const [rewardVisible, setRewardVisible] = useState(false);
  const [milestoneMessage, setMilestoneMessage] = useState<string | null>(null);
  const [milestoneVisible, setMilestoneVisible] = useState(false);
  const [flashWord, setFlashWord] = useState<string | null>(null);
  const [flashVisible, setFlashVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [combo, setCombo] = useState(0);
  const [finished, setFinished] = useState(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rewardTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const milestoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTouchPressRef = useRef<{ cellId: number; at: number } | null>(null);
  const lastControlTouchRef = useRef<{ key: string; at: number } | null>(null);
  const lastMilestoneRef = useRef<number>(0);

  const totalAttempts = hits + misses;
  const accuracy = totalAttempts === 0 ? 0 : Math.round((hits / totalAttempts) * 100);
  const currentPaceLabel = pace.toUpperCase();
  const currentModeLabel = mode === "classic" ? "CLASSIC MODE" : "SPEED FLASH MODE";
  const rewardToneClassName =
    combo >= 5
      ? "border-zinc-300/60 bg-zinc-900/95 text-zinc-50 opacity-100 tracking-[0.28em] font-semibold"
      : combo >= 3
        ? "border-zinc-700/60 bg-zinc-900/75 text-zinc-100 opacity-95 tracking-[0.24em] font-medium"
        : "border-transparent bg-transparent text-zinc-300 opacity-90 tracking-[0.22em] font-semibold";
  const rewardTextClassName =
    combo >= 5
      ? "text-[1.05rem] sm:text-[1.1rem]"
      : combo >= 3
        ? "text-[0.98rem] sm:text-[1.02rem]"
        : "text-[0.95rem] sm:text-[0.98rem]";
  const visibleRewardMessage = milestoneMessage ?? rewardMessage;
  const visibleRewardToneClassName = milestoneMessage
    ? "border-zinc-300/70 bg-zinc-900/95 text-zinc-50 opacity-100 tracking-[0.28em] font-semibold"
    : rewardToneClassName;
  const visibleRewardTextClassName = milestoneMessage ? "text-[1.08rem] sm:text-[1.16rem]" : rewardTextClassName;

  useEffect(() => {
    if (!running) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      if (mode === "speedFlash") {
        const nextWord = pickFlashWord();
        setBoard(createSpeedFlashBoard(nextWord));
        setFlashWord(nextWord);
        setFlashVisible(true);

        if (flashTimeoutRef.current) {
          clearTimeout(flashTimeoutRef.current);
        }
        const flashDuration = 300 + Math.floor(Math.random() * 501);
        flashTimeoutRef.current = setTimeout(() => {
          setFlashVisible(false);
        }, flashDuration);

        setFeedback(null);
        timeoutId = setTimeout(tick, flashDuration + getNextDelay(pace));
        return;
      }

      setBoard((prevBoard) => createNextBoard(prevBoard.cells));
      setFeedback(null);
      timeoutId = setTimeout(tick, getNextDelay(pace));
    };

    timeoutId = setTimeout(tick, mode === "speedFlash" ? 100 : getNextDelay(pace));

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, [running, pace, mode]);

  useEffect(() => {
    if (!running) return;

    const countdownId = setInterval(() => {
      setTimeLeft((currentTime) => {
        if (currentTime <= 1) {
          setRunning(false);
          setStatus("FINISHED");
          setFinished(true);
          setFeedback(null);
          setCombo(0);
          setFlashVisible(false);
          return 0;
        }

        return currentTime - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownId);
    };
  }, [running]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      if (rewardTimeoutRef.current) {
        clearTimeout(rewardTimeoutRef.current);
      }
      if (milestoneTimeoutRef.current) {
        clearTimeout(milestoneTimeoutRef.current);
      }
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  function showRewardFeedback(nextMessage: string) {
    if (rewardTimeoutRef.current) {
      clearTimeout(rewardTimeoutRef.current);
    }

    setRewardMessage(nextMessage);
    setRewardVisible(true);

    const visibleDuration = 500 + Math.floor(Math.random() * 401);
    rewardTimeoutRef.current = setTimeout(() => {
      setRewardVisible(false);
      rewardTimeoutRef.current = setTimeout(() => {
        setRewardMessage(null);
      }, 120);
    }, visibleDuration);
  }

  function showMilestoneFeedback(nextMessage: string) {
    if (milestoneTimeoutRef.current) {
      clearTimeout(milestoneTimeoutRef.current);
    }

    setMilestoneMessage(nextMessage);
    setMilestoneVisible(true);

    const visibleDuration = 700 + Math.floor(Math.random() * 501);
    milestoneTimeoutRef.current = setTimeout(() => {
      setMilestoneVisible(false);
      milestoneTimeoutRef.current = setTimeout(() => {
        setMilestoneMessage(null);
      }, 120);
    }, visibleDuration);
  }

  function pickRewardMessage(currentCombo: number): string {
    const roll = Math.random();

    if (currentCombo >= 5) {
      if (roll < 0.45) return "Focus";
      if (roll < 0.75) return "Great";
      if (roll < 0.95) return "Combo +1";
      return "Nice";
    }

    if (currentCombo >= 3) {
      if (roll < 0.4) return "Great";
      if (roll < 0.75) return "Combo +1";
      if (roll < 0.92) return "Focus";
      return "Nice";
    }

    if (roll < 0.55) return "Nice";
    if (roll < 0.8) return "Great";
    if (roll < 0.95) return "Combo +1";
    return "Focus";
  }

  function showFeedback(nextFeedback: Feedback) {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    setFeedback(nextFeedback);
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, 650);
  }

  function handleCellPress(cellId: number) {
    if (!running) return;
    if (finished) return;
    if (timeLeft <= 0) return;
    if (!board.targetId) return;

    if (cellId === board.targetId) {
      setHits((currentHits) => currentHits + 1);
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      if (nextCombo === 3 && lastMilestoneRef.current !== 3) {
        lastMilestoneRef.current = 3;
        showMilestoneFeedback("COMBO x3");
      } else if (nextCombo === 5 && lastMilestoneRef.current !== 5) {
        lastMilestoneRef.current = 5;
        showMilestoneFeedback("HOT STREAK");
      } else if (nextCombo === 10 && lastMilestoneRef.current !== 10) {
        lastMilestoneRef.current = 10;
        showMilestoneFeedback("FOCUS MODE");
      } else {
        showRewardFeedback(pickRewardMessage(nextCombo));
      }
      showFeedback("Correct");
      return;
    }

    setMisses((currentMisses) => currentMisses + 1);
    setCombo(0);
    if (rewardTimeoutRef.current) {
      clearTimeout(rewardTimeoutRef.current);
      rewardTimeoutRef.current = undefined;
    }
    if (milestoneTimeoutRef.current) {
      clearTimeout(milestoneTimeoutRef.current);
      milestoneTimeoutRef.current = undefined;
    }
    setRewardVisible(false);
    setRewardMessage(null);
    setMilestoneVisible(false);
    setMilestoneMessage(null);
    showFeedback("Miss");
  }

  function handleCellPointerUp(cellId: number, event: ReactPointerEvent<HTMLButtonElement>) {
    // Touch path is primary on mobile; click remains as fallback.
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    event.preventDefault();
    lastTouchPressRef.current = { cellId, at: event.timeStamp };
    handleCellPress(cellId);
  }

  function handleCellTouchEnd(cellId: number, event: ReactTouchEvent<HTMLButtonElement>) {
    event.preventDefault();
    lastTouchPressRef.current = { cellId, at: event.timeStamp };
    handleCellPress(cellId);
  }

  function handleCellClick(cellId: number, event: ReactMouseEvent<HTMLButtonElement>) {
    // iOS/Android often dispatch click after pointerup; suppress duplicate scoring.
    const lastTouch = lastTouchPressRef.current;
    if (lastTouch && lastTouch.cellId === cellId && event.timeStamp - lastTouch.at < 450) {
      lastTouchPressRef.current = null;
      return;
    }
    handleCellPress(cellId);
  }

  function isDuplicateControlTouch(controlKey: string, at: number): boolean {
    const prev = lastControlTouchRef.current;
    if (!prev) return false;
    return prev.key === controlKey && at - prev.at < 450;
  }

  function markControlTouch(controlKey: string, at: number) {
    lastControlTouchRef.current = { key: controlKey, at };
  }

  function handleStartTouch(event: ReactTouchEvent<HTMLButtonElement>) {
    markControlTouch("start", event.timeStamp);
    handleStart();
  }

  function handlePauseTouch(event: ReactTouchEvent<HTMLButtonElement>) {
    markControlTouch("pause", event.timeStamp);
    handlePause();
  }

  function handleResetTouch(event: ReactTouchEvent<HTMLButtonElement>) {
    markControlTouch("reset", event.timeStamp);
    handleReset();
  }

  function handleStart() {
    if (timeLeft <= 0) return;
    setFinished(false);
    setFeedback(null);
    setRunning(true);
    setStatus("RUNNING");
  }

  function handlePause() {
    setRunning(false);
    setStatus("PAUSED");
    setFlashVisible(false);
  }

  function handleReset() {
    setRunning(false);
    setStatus("READY");
    if (mode === "classic") {
      setBoard(createInitialBoard());
      setFlashWord(null);
    } else {
      const firstWord = pickFlashWord();
      setBoard(createSpeedFlashBoard(firstWord));
      setFlashWord(firstWord);
    }
    setPace("medium");
    setFeedback(null);
    setTimeLeft(ROUND_SECONDS);
    setHits(0);
    setMisses(0);
    setCombo(0);
    lastMilestoneRef.current = 0;
    setFinished(false);

    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    if (rewardTimeoutRef.current) {
      clearTimeout(rewardTimeoutRef.current);
    }
    if (milestoneTimeoutRef.current) {
      clearTimeout(milestoneTimeoutRef.current);
    }
    setRewardVisible(false);
    setRewardMessage(null);
    setMilestoneVisible(false);
    setMilestoneMessage(null);
    setFlashVisible(false);

    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }
  }

  function handlePlayAgain() {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    if (mode === "classic") {
      setBoard(createInitialBoard());
      setFlashWord(null);
    } else {
      const firstWord = pickFlashWord();
      setBoard(createSpeedFlashBoard(firstWord));
      setFlashWord(firstWord);
    }
    setTimeLeft(ROUND_SECONDS);
    setHits(0);
    setMisses(0);
    setCombo(0);
    lastMilestoneRef.current = 0;
    setFeedback(null);
    setRewardVisible(false);
    setRewardMessage(null);
    setMilestoneVisible(false);
    setMilestoneMessage(null);
    setFlashVisible(false);
    setFinished(false);
    setRunning(true);
    setStatus("RUNNING");

    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }
  }

  function handleModeChange(nextMode: TrainingMode) {
    if (running || mode === nextMode) return;

    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }
    setFlashVisible(false);

    if (nextMode === "classic") {
      setFlashWord(null);
      setBoard(createInitialBoard());
    } else {
      const firstWord = pickFlashWord();
      setFlashWord(firstWord);
      setBoard(createSpeedFlashBoard(firstWord));
    }

    setMode(nextMode);
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-zinc-950 px-4 py-8 text-zinc-100 sm:py-10">
      <section className="mx-auto flex min-h-[80vh] w-full max-w-full flex-col items-center justify-center gap-5 overflow-x-hidden pointer-events-auto sm:max-w-xl sm:gap-6">
        <h1 className="pointer-events-none text-center text-xl font-semibold tracking-[0.18em] text-zinc-200 sm:text-2xl sm:tracking-[0.28em]">
          SPEED READING GRID
        </h1>

        <div className="grid w-full max-w-[22rem] grid-cols-3 gap-2 text-center pointer-events-none sm:max-w-[26rem] sm:gap-3">
          <div className={infoCardClassName}>
            <div className={infoLabelClassName}>TIME</div>
            <div className={infoValueStrongClassName}>{timeLeft}s</div>
          </div>
          <div className={infoCardClassName}>
            <div className={infoLabelClassName}>HITS</div>
            <div className={infoValueClassName}>{hits}</div>
          </div>
          <div className={infoCardClassName}>
            <div className={infoLabelClassName}>MISS</div>
            <div className={infoValueClassName}>{misses}</div>
          </div>
        </div>

        <div
          className={`w-full max-w-[22rem] pointer-events-none ${infoCardClassName} sm:max-w-[26rem] ${
            combo >= 5
              ? "border-zinc-300/70 bg-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.05),0_16px_34px_rgba(0,0,0,0.36)]"
              : ""
          }`}
        >
          <div className={infoLabelClassName}>COMBO</div>
          <div
            className={`mt-1 font-semibold tracking-[0.18em] text-zinc-100 ${
              combo >= 5
                ? "text-[1.45rem] sm:text-[1.6rem]"
                : combo >= 3
                  ? "text-[1.3rem] sm:text-[1.45rem]"
                  : "text-[1.2rem] sm:text-[1.3rem]"
            }`}
          >
            x{combo}
          </div>
        </div>

        <div
          className={`pointer-events-none min-h-6 text-center text-xs transition-opacity duration-200 ${visibleRewardToneClassName} ${
            rewardVisible || milestoneVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className={visibleRewardTextClassName}>{visibleRewardMessage ?? " "}</span>
        </div>

        <div className="grid w-full max-w-[22rem] grid-cols-2 gap-2 pointer-events-auto sm:max-w-[26rem]">
          <button
            type="button"
            onClick={() => handleModeChange("classic")}
            disabled={running}
            className={`min-h-11 touch-manipulation rounded-md border px-3 text-sm font-semibold tracking-wide transition duration-200 ease-out ${
              mode === "classic"
                ? "border-zinc-200 bg-zinc-100 text-zinc-950 shadow-[0_6px_18px_rgba(0,0,0,0.22)]"
                : "border-zinc-700/80 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
            } disabled:cursor-not-allowed disabled:opacity-45`}
          >
            Classic Mode
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("speedFlash")}
            disabled={running}
            className={`min-h-11 touch-manipulation rounded-md border px-3 text-sm font-semibold tracking-wide transition duration-200 ease-out ${
              mode === "speedFlash"
                ? "border-zinc-200 bg-zinc-100 text-zinc-950 shadow-[0_6px_18px_rgba(0,0,0,0.22)]"
                : "border-zinc-700/80 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
            } disabled:cursor-not-allowed disabled:opacity-45`}
          >
            Speed Flash
          </button>
        </div>

        <div className={`w-full max-w-[22rem] pointer-events-none ${infoCardClassName} sm:max-w-[26rem]`}>
          <div className={infoLabelClassName}>CURRENT PACE</div>
          <div className={infoValueStrongClassName}>{currentPaceLabel}</div>
        </div>

        <div className={`w-full max-w-[22rem] pointer-events-none ${infoCardClassName} sm:max-w-[26rem]`}>
          <div className={infoLabelClassName}>CURRENT MODE</div>
          <div className={infoValueStrongClassName}>{currentModeLabel}</div>
        </div>

        <div className="grid w-full max-w-[22rem] grid-cols-3 gap-2 pointer-events-auto sm:max-w-[26rem] sm:gap-3">
          {PACE_OPTIONS.map((option) => {
            const active = option.value === pace;
            const locked = running;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPace(option.value)}
                disabled={locked}
                className={`min-h-11 touch-manipulation rounded-md border px-3 text-sm font-semibold tracking-wide transition duration-200 ease-out ${
                  active
                    ? "border-zinc-200 bg-zinc-100 text-zinc-950 shadow-[0_6px_18px_rgba(0,0,0,0.22)]"
                    : "border-zinc-700/80 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 hover:shadow-[0_4px_14px_rgba(0,0,0,0.16)]"
                } ${locked ? "cursor-not-allowed opacity-45 shadow-none" : ""} disabled:cursor-not-allowed disabled:opacity-45`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pointer-events-auto sm:gap-3">
          <button
            type="button"
            onTouchStart={handleStartTouch}
            onClick={(event) => {
              if (isDuplicateControlTouch("start", event.timeStamp)) return;
              handleStart();
            }}
            className={`${controlButtonClassName} border-zinc-500 bg-zinc-800 text-zinc-100 hover:border-zinc-400 hover:bg-zinc-700 hover:shadow-[0_6px_18px_rgba(0,0,0,0.18)] active:scale-[0.99]`}
            disabled={running || timeLeft <= 0}
          >
            Start
          </button>
          <button
            type="button"
            onTouchStart={handlePauseTouch}
            onClick={(event) => {
              if (isDuplicateControlTouch("pause", event.timeStamp)) return;
              handlePause();
            }}
            className={`${controlButtonClassName} border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:shadow-[0_6px_18px_rgba(0,0,0,0.14)] active:scale-[0.99]`}
            disabled={!running}
          >
            Pause
          </button>
          <button
            type="button"
            onTouchStart={handleResetTouch}
            onClick={(event) => {
              if (isDuplicateControlTouch("reset", event.timeStamp)) return;
              handleReset();
            }}
            className={`${controlButtonClassName} border-zinc-700 bg-transparent text-zinc-400 hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 active:scale-[0.99]`}
          >
            Reset
          </button>
        </div>

        <div className={`w-full max-w-[22rem] pointer-events-none ${infoCardClassName} sm:max-w-[26rem]`}>
          <div className={infoLabelClassName}>STATUS</div>
          <div className={infoValueStrongClassName}>{status}</div>
        </div>

        <div className="relative z-10 grid w-full max-w-[22rem] grid-cols-3 gap-2 pointer-events-auto sm:max-w-[26rem] sm:gap-4">
          {mode === "speedFlash" ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <span
                className={`rounded-md border border-zinc-500/70 bg-zinc-950/92 px-4 py-2 text-sm font-semibold tracking-[0.28em] text-zinc-100 transition-opacity duration-150 sm:text-base ${
                  flashVisible ? "opacity-100" : "opacity-0"
                }`}
              >
                {flashWord ?? ""}
              </span>
            </div>
          ) : null}
          {board.cells.map((cell) => (
            <button
              key={cell.id}
              type="button"
              onTouchEnd={(event) => handleCellTouchEnd(cell.id, event)}
              onClick={(event) => handleCellClick(cell.id, event)}
              onPointerUp={(event) => handleCellPointerUp(cell.id, event)}
              disabled={!running || finished || timeLeft <= 0}
              className={`flex aspect-square items-center justify-center pointer-events-auto ${gridCellBaseClassName} ${
                mode === "speedFlash"
                  ? "text-[0.72rem] font-semibold tracking-[0.14em] sm:text-[0.9rem]"
                  : "text-3xl font-bold sm:text-4xl"
              } ${getCellStyle(cell.state)} shadow-[0_1px_0_rgba(255,255,255,0.03),0_12px_24px_rgba(0,0,0,0.24)] ${
                cell.id === board.targetId && cell.state === "visible"
                  ? "border-zinc-200/75 shadow-[0_1px_0_rgba(255,255,255,0.03),0_14px_28px_rgba(0,0,0,0.3)]"
                  : "hover:-translate-y-[1px] hover:border-zinc-500 hover:shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
              } cursor-pointer disabled:pointer-events-none disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-[0_1px_0_rgba(255,255,255,0.03),0_12px_24px_rgba(0,0,0,0.24)]`}
            >
              {cell.text}
            </button>
          ))}
        </div>

        <div className="pointer-events-none min-h-6 text-sm font-semibold tracking-[0.18em] text-zinc-300">
          {feedback}
        </div>

        {finished ? (
          <div className="w-full max-w-[22rem] rounded-md border border-zinc-700/80 bg-zinc-900/90 px-4 py-4 text-center shadow-[0_1px_0_rgba(255,255,255,0.03),0_16px_34px_rgba(0,0,0,0.32)] pointer-events-auto sm:max-w-[26rem]">
            <div className="text-xs font-semibold tracking-[0.24em] text-zinc-400">
              TRAINING COMPLETE
            </div>
            <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3">
              <div className="text-xs font-semibold tracking-[0.18em] text-zinc-500">ACCURACY</div>
              <div className="mt-1 text-3xl font-semibold text-zinc-50 sm:text-4xl">{accuracy}%</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold text-zinc-200">
              <div className="rounded-md border border-zinc-800 bg-zinc-950 py-2">Hits {hits}</div>
              <div className="rounded-md border border-zinc-800 bg-zinc-950 py-2">
                Misses {misses}
              </div>
            </div>
            <button
              type="button"
              onTouchStart={(event) => {
                markControlTouch("playagain", event.timeStamp);
                handlePlayAgain();
              }}
              onClick={(event) => {
                if (isDuplicateControlTouch("playagain", event.timeStamp)) return;
                handlePlayAgain();
              }}
              className="mt-4 w-full touch-manipulation rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-semibold tracking-[0.12em] text-zinc-900 transition duration-200 ease-out hover:border-zinc-100 hover:bg-zinc-200 active:scale-[0.99]"
            >
              Play Again
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
