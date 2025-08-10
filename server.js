const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// === Puzzle Solver Logic ===
// Board represented as 1D array, 0 = empty tile

// Utility functions
function manhattanDistance(board, size) {
  let dist = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0) continue;
    let targetX = (board[i] - 1) % size;
    let targetY = Math.floor((board[i] - 1) / size);
    let x = i % size;
    let y = Math.floor(i / size);
    dist += Math.abs(x - targetX) + Math.abs(y - targetY);
  }
  return dist;
}

function getNeighbors(state, size) {
  const neighbors = [];
  const zeroPos = state.indexOf(0);
  const x = zeroPos % size;
  const y = Math.floor(zeroPos / size);

  const moves = [
    { dx: -1, dy: 0, dir: "LEFT" },
    { dx: 1, dy: 0, dir: "RIGHT" },
    { dx: 0, dy: -1, dir: "UP" },
    { dx: 0, dy: 1, dir: "DOWN" },
  ];

  for (const move of moves) {
    const newX = x + move.dx;
    const newY = y + move.dy;
    if (newX >= 0 && newX < size && newY >= 0 && newY < size) {
      const newZeroPos = newY * size + newX;
      const newState = state.slice();
      [newState[zeroPos], newState[newZeroPos]] = [newState[newZeroPos], newState[zeroPos]];
      neighbors.push({ state: newState, move: move.dir });
    }
  }
  return neighbors;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function boardToString(board) {
  return board.join(",");
}

// === A* solver (for 3x3) ===
function solveAStar(startState, size) {
  const goalState = [];
  for (let i = 1; i < size * size; i++) goalState.push(i);
  goalState.push(0);

  const openSet = new Map();
  const closedSet = new Set();

  const startKey = boardToString(startState);
  openSet.set(startKey, {
    state: startState,
    g: 0,
    h: manhattanDistance(startState, size),
    f: 0 + manhattanDistance(startState, size),
    parent: null,
    move: null,
  });

  while (openSet.size > 0) {
    // Get node with lowest f
    let currentEntry = null;
    for (const entry of openSet.values()) {
      if (!currentEntry || entry.f < currentEntry.f) currentEntry = entry;
    }

    if (arraysEqual(currentEntry.state, goalState)) {
      // Reconstruct path
      const path = [];
      let node = currentEntry;
      while (node.move !== null) {
        path.push(node.move);
        node = node.parent;
      }
      return path.reverse();
    }

    openSet.delete(boardToString(currentEntry.state));
    closedSet.add(boardToString(currentEntry.state));

    const neighbors = getNeighbors(currentEntry.state, size);
    for (const neighbor of neighbors) {
      const neighborKey = boardToString(neighbor.state);
      if (closedSet.has(neighborKey)) continue;

      const tentativeG = currentEntry.g + 1;
      const neighborNode = openSet.get(neighborKey);

      const h = manhattanDistance(neighbor.state, size);
      const f = tentativeG + h;

      if (!neighborNode || tentativeG < neighborNode.g) {
        openSet.set(neighborKey, {
          state: neighbor.state,
          g: tentativeG,
          h,
          f,
          parent: currentEntry,
          move: neighbor.move,
        });
      }
    }
  }
  return null; // no solution
}

// === IDA* solver (for 4x4, 5x5) ===
function solveIDAStar(startState, size) {
  const goalState = [];
  for (let i = 1; i < size * size; i++) goalState.push(i);
  goalState.push(0);

  function search(path, g, threshold) {
    const node = path[path.length - 1];
    const f = g + manhattanDistance(node, size);
    if (f > threshold) return f;
    if (arraysEqual(node, goalState)) return "FOUND";

    let min = Infinity;
    const neighbors = getNeighbors(node, size);

    for (const neighbor of neighbors) {
      if (path.some(p => arraysEqual(p, neighbor.state))) continue;

      path.push(neighbor.state);
      const t = search(path, g + 1, threshold);
      if (t === "FOUND") {
        moves.push(neighbor.move);
        return "FOUND";
      }
      if (t < min) min = t;
      path.pop();
    }
    return min;
  }

  let threshold = manhattanDistance(startState, size);
  let moves = [];
  const path = [startState];

  while (true) {
    const t = search(path, 0, threshold);
    if (t === "FOUND") return moves.reverse();
    if (t === Infinity) return null;
    threshold = t;
  }
}

// === API Endpoint ===
app.post("/solve", (req, res) => {
  const { board, size } = req.body;

  if (!board || !size) {
    return res.status(400).json({ error: "board and size required" });
  }

  // Flatten 2D board to 1D array, replace null or 0 as 0
  const flatBoard = board.flat().map(x => (x === null ? 0 : x));

  let solution = null;

  if (size === 3) {
    solution = solveAStar(flatBoard, size);
  } else if (size === 4 || size === 5) {
    solution = solveIDAStar(flatBoard, size);
  } else {
    return res.status(400).json({ error: "Unsupported size" });
  }

  if (!solution) {
    return res.status(400).json({ error: "No solution found or timeout" });
  }

  res.json({ solution });
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
