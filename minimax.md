# Triple Triad Minimax Implementation Plan

## Core Components Overview

A minimax implementation for Triple Triad requires careful state representation, efficient move generation, and strategic evaluation. Here's a comprehensive plan covering necessary and optional optimizations.

---

## 1) Board State Representation

### Fundamental State Structure

The board state must track four key pieces of information:

**Grid Content**: A 3×3 array where each cell contains:

- **Card identity** (which card occupies the space, or null if empty)
- **Owner** (player 1, player 2, or unowned)
- **Card orientation** (implicit based on placement, not stored separately)

**Player Hands**: For each player, maintain:

- **Set of remaining cards** not yet played
- **Card attributes** (north, south, east, west strengths for each card)

**Turn information**:

- **Current player** to move (alternates)
- **Move count** (0–9, determines when game ends)

### Efficient Encoding: Bitboard Representation (Necessary Optimization)

Rather than storing full objects, use compact integer representations:

| Component             | Representation                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Grid ownership**    | Two 9-bit integers (one per player), where bit position = grid position; bit value = 1 if player owns that cell |
| **Card on each cell** | 9-value array of card IDs (0–19 for a standard deck of 20 cards, null for empty)                                |
| **Player hands**      | Two 20-bit bitmasks where bit N = 1 if player still holds card N                                                |
| **Card stats**        | Look-up table: `cardStats[cardID] = {north, south, east, west}` (precomputed, immutable)                        |

**Why this matters**: Bitboards allow fast copying (single integer assignment), fast comparison (bitwise operations), and low memory footprint. A single game state can fit in ~100 bytes.

### State Object Structure (Pseudocode)

```
State {
  grid[9]              // card IDs on each cell
  owner[9]             // 0 = empty, 1 = player 1, 2 = player 2
  hand1, hand2         // bitmasks of remaining cards
  currentPlayer        // 1 or 2
  moveCount            // 0–9
}
```

---

## 2) Determining the Next Best Move (Minimax Logic)

### Move Generation

At each state, generate **all legal moves**:

1. For each card in the current player's hand (iterate through their bitmask)
2. For each empty grid cell (9 cells max, but fewer as game progresses)
3. Create a new state representing that move
4. Return the list of `(cardID, gridPosition, resultingState)` tuples

**Complexity**: O(cards × empty cells) = O(5 × 9) = O(45) per node.

### Minimax Recursion with Alpha-Beta Pruning (Necessary Optimization)

```
function minimax(state, depth, alpha, beta, maximizingPlayer):

  // Terminal condition: board full
  if state.moveCount == 9:
    return (evaluateState(state), null)

  // Depth limit (search cutoff to make search tractable)
  if depth == 0:
    return (evaluateState(state), null)

  if maximizingPlayer:  // AI's turn (trying to maximize score)
    maxScore = -∞
    bestMove = null

    for each move in generateMoves(state):
      nextState = applyMove(state, move)
      score, _ = minimax(nextState, depth - 1, alpha, beta, false)

      if score > maxScore:
        maxScore = score
        bestMove = move

      alpha = max(alpha, maxScore)
      if beta <= alpha:
        break  // Beta cutoff: prune branch

    return (maxScore, bestMove)

  else:  // Opponent's turn (trying to minimize AI's score)
    minScore = +∞
    bestMove = null

    for each move in generateMoves(state):
      nextState = applyMove(state, move)
      score, _ = minimax(nextState, depth - 1, alpha, beta, true)

      if score < minScore:
        minScore = score
        bestMove = move

      beta = min(beta, minScore)
      if beta <= alpha:
        break  // Alpha cutoff: prune branch

    return (minScore, bestMove)
```

**Alpha-beta pruning** eliminates branches where the opponent will never allow the search to reach. In Triple Triad, this can reduce the effective branching factor from ~40 to ~10–15, cutting search time dramatically.

---

## 3) State Evaluation Function

### Board Scoring (Fundamental)

The **heuristic evaluation** estimates the game outcome from a non-terminal state:

```
function evaluateState(state):
  player1Cards = countSetBits(state.owner1)  // count of cards player 1 owns
  player2Cards = countSetBits(state.owner2)  // count of cards player 2 owns

  // Simple: raw card count difference
  return player1Cards - player2Cards
```

### Enhanced Evaluation (Recommended)

Include positional and strength factors:

```
function evaluateState(state):
  score = 0

  // 1. Card ownership (most important)
  score += 100 * (countCards(player1) - countCards(player2))

  // 2. Card strength advantage
  // For each card on the board, add its average strength to its owner's score
  for each cell in grid:
    if cell is owned by player1:
      strength = avgStrength(cardOnCell)
      score += 2 * strength
    else if cell is owned by player2:
      score -= 2 * strength

  // 3. Control of corners (harder to capture)
  cornerPositions = [0, 2, 6, 8]
  for pos in cornerPositions:
    if grid[pos] owned by player1:
      score += 5
    else if grid[pos] owned by player2:
      score -= 5

  // 4. Hand strength (cards not yet played)
  hand1Strength = sum of strengths of cards in player1's hand
  hand2Strength = sum of strengths of cards in player2's hand
  score += (hand1Strength - hand2Strength) * 0.5

  return score
```

---

## Necessary Optimizations

### 1) **Alpha-Beta Pruning** (Already Described Above)

**Impact**: Reduces search nodes by ~80%, allowing deeper searches in the same time budget.

---

### 2) **Move Ordering** (Necessary for Pruning Effectiveness)

Alpha-beta pruning's effectiveness depends heavily on **examining the best moves first**. Poor move ordering can reduce pruning from 80% to near 0%.

**Heuristic Move Ordering**:

1. **Capture moves first**: Moves that flip opponent cards (immediate win for current player)
2. **Moves that secure corners**: High strategic value
3. **Moves that play strong cards**: High average strength
4. **Moves in the center**: Potential for more captures
5. **All other moves**

```
function orderMoves(moves, state):
  // Evaluate and rank each move by heuristic
  scoredMoves = []

  for move in moves:
    nextState = applyMove(state, move)
    captureCount = countFlips(nextState, move)
    cardStrength = avgStrength(move.cardID)
    gridPosition = move.gridPosition
    cornerBonus = 10 if gridPosition in corners else 0

    score = 1000 * captureCount + 10 * cardStrength + cornerBonus
    scoredMoves.append((score, move))

  // Sort descending by score
  return sort(scoredMoves, reverse=True)
```

**Impact**: Can improve pruning effectiveness by 3–5×, reducing total nodes searched.

---

### 3) **Transposition Table (Memoization)** (Necessary for Deeper Search)

Multiple move sequences can lead to identical board states. Caching evaluation results prevents redundant computation.

**Implementation**:

- Use a hash map: `cache[stateHash] = (score, depth)`
- Hash the board state using **Zobrist hashing** (fast, collision-resistant)

```
function zobristHash(state):
  hash = 0

  for i in range(9):
    if grid[i] has a card:
      hash ^= zobristTable[i][cardID][ownerID]

  for player in [1, 2]:
    for cardID in hand[player]:
      hash ^= zobristTableHand[player][cardID]

  hash ^= zobristPlayer[currentPlayer]  // XOR in whose turn it is

  return hash
```

**Cache lookup**:

```
function minimax(state, depth, alpha, beta, maximizing):
  hash = zobristHash(state)

  if hash in cache:
    cachedScore, cachedDepth = cache[hash]
    if cachedDepth >= depth:
      return (cachedScore, null)  // Cached result is deep enough

  // ... perform minimax search ...

  cache[hash] = (score, depth)  // Store result
  return (score, bestMove)
```

**Impact**: Reduces redundant searches by 30–50%, allowing 1–2 additional ply of search depth.

---

### 4) **Iterative Deepening with Time Control** (Necessary for Real Play)

In interactive play, you can't afford to wait indefinitely for a search to complete. **Iterative deepening** searches depth 1, then 2, then 3, etc., returning the best move found so far when time runs out.

```
function findBestMoveWithTimeLimit(state, timeLimit):
  startTime = now()
  bestMove = null

  for depth in [1, 2, 3, 4, 5, ...]:
    if (now() - startTime) > timeLimit:
      break

    score, move = minimax(state, depth, -∞, +∞, true)
    if move is not null:
      bestMove = move

  return bestMove
```

**Benefits**:

- Always returns a move (no timeout hangs)
- Earlier depths inform move ordering for deeper searches
- Total time overhead is modest (~10% more nodes than direct deep search)

---

## Optional Optimizations

### 1) **Killer Move Heuristic** (Intermediate Difficulty)

**What it is**: Moves that caused cutoffs in sibling nodes are likely to cause cutoffs here too.

**How it helps**: Improves move ordering without expensive evaluation; can improve pruning by 10–20%.

**Implementation**:

```
killerMoves = {}  // Map from depth → list of moves that caused cutoffs

function orderMoves(moves, depth):
  scored = []
  for move in moves:
    baseScore = calculateMoveScore(move)  // Capture count, etc.
    killerBonus = 500 if move in killerMoves[depth] else 0
    scored.append((baseScore + killerBonus, move))

  return sort(scored, reverse=True)

// In minimax, when a beta cutoff occurs:
killerMoves[depth].append(causingMove)
```

---

### 2) **History Heuristic** (Intermediate Difficulty)

**What it is**: Track which moves have caused cutoffs globally (not just at one depth).

**How it helps**: Refines move ordering based on historical success; works well in conjunction with transposition tables.

**Implementation**:

```
history = {}  // Map from (cardID, gridPosition) → cutoffCount

function orderMoves(moves):
  scored = []
  for move in moves:
    baseScore = calculateMoveScore(move)
    historicalBonus = history.get((move.cardID, move.gridPosition), 0)
    scored.append((baseScore + historicalBonus, move))

  return sort(scored, reverse=True)

// In minimax, when a beta cutoff occurs:
history[(move.cardID, move.gridPosition)] += 2^depth
```

---

### 3) **Quiescence Search** (Intermediate Difficulty)

**What it is**: Continue searching past the depth limit in "unstable" positions (ones with pending captures).

**How it helps**: Avoids "horizon effect" where the AI misjudges a position because a large flip happens just beyond the search depth.

**Implementation**:

```
function minimax(state, depth, alpha, beta, maximizing):
  if depth == 0:
    return (quiescence(state, alpha, beta, maximizing), null)

  // ... standard minimax ...

function quiescence(state, alpha, beta, maximizing):
  standingPat = evaluateState(state)

  if maximizing:
    if standingPat >= beta:
      return beta
    alpha = max(alpha, standingPat)
  else:
    if standingPat <= alpha:
      return alpha
    beta = min(beta, standingPat)

  // Only explore moves that capture cards (volatile positions)
  for move in generateCaptureMoves(state):
    nextState = applyMove(state, move)
    score = quiescence(nextState, alpha, beta, not maximizing)

    if maximizing:
      alpha = max(alpha, score)
      if beta <= alpha:
        break
    else:
      beta = min(beta, score)
      if beta <= alpha:
        break

  return alpha if maximizing else beta
```

**Impact**: Improves move quality by 5–15% when combined with moderate depth limits (5–7 ply).

---

### 4) **Aspiration Windows** (Advanced)

**What it is**: Instead of searching with `alpha = -∞, beta = +∞`, use a narrow window around the previous iteration's score. Re-search with wider windows if the result falls outside.

**How it helps**: Dramatic pruning improvement; can enable 1–2 additional ply.

**Implementation**:

```
function findBestMoveWithAspirationWindows(state, timeLimit):
  startTime = now()
  bestMove = null
  previousScore = 0
  window = 50  // Initial window width

  for depth in [1, 2, 3, 4, 5, ...]:
    if (now() - startTime) > timeLimit:
      break

    // Try narrow window first
    alpha = previousScore - window
    beta = previousScore + window

    while true:
      score, move = minimax(state, depth, alpha, beta, true)

      if score <= alpha:
        // Score fell below window; re-search with wider alpha
        alpha = score - 2 * window
      else if score >= beta:
        // Score exceeded window; re-search with wider beta
        beta = score + 2 * window
      else:
        // Score within window; move is good
        bestMove = move
        previousScore = score
        break

    window *= 1.5  // Expand window for next depth

  return bestMove
```

**Impact**: 20–40% reduction in nodes when combined with move ordering and transposition tables.

---

### 5) **Principal Variation Search (PVS)** (Advanced)

**What it is**: A refinement of alpha-beta that searches the first move with a wide window, then uses a null-window search on remaining moves for faster pruning.

**How it helps**: Maintains alpha-beta's correctness while often achieving tighter bounds faster; 10–30% fewer nodes than standard alpha-beta.

**Implementation**: (Pseudocode outline)

```
function pvs(state, depth, alpha, beta, maximizing):
  if depth == 0:
    return evaluateState(state)

  moves = orderMoves(generateMoves(state))

  if maximizing:
    score = pvs(applyMove(state, moves[0]), depth-1, alpha, beta, false)

    for move in moves[1:]:
      // Search with null window [α, α+1)
      score = pvs(applyMove(state, move), depth-1, alpha, alpha+1, false)

      if score > alpha and score < beta:
        // Re-search with full window
        score = pvs(applyMove(state, move), depth-1, score, beta, false)

      alpha = max(alpha, score)
      if alpha >= beta:
        break

    return alpha
  else:
    // ... symmetric for minimizing player ...
```

---

### 6) **Endgame Tablebases** (Specialized Optimization)

**What it is**: Precompute exact outcomes for all board states with ≤3 cards remaining.

**How it helps**: Evaluates endgames perfectly instead of heuristically; improves final moves and reduces search depth needed.

**Implementation**:

- Generate all possible 3-card states (manageable: ~10^6)
- Recursively compute the winner for each (minimax with no heuristic, only exact wins/losses)
- Store in a compact on-disk database
- During search, check database before evaluating

**Impact**: Makes endgame moves optimal; reduces overall search depth requirement by 1–2 ply.

---

### 7) **Pattern Recognition & Learning** (Very Advanced) — Continued

**Example**:

```
function evaluateState(state):
  baseScore = standardEvaluation(state)

  // Pattern bonuses
  for each 2x2 sub-grid:
    if all 4 cells owned by same player:
      baseScore += 50 * ownerMultiplier  // Control bonus

  for each row/column:
    if 2+ cards owned by same player and adjacent:
      baseScore += 20 * ownerMultiplier  // Connectivity bonus

  // Line-of-sight patterns (potential for cascading captures)
  for each potential future move position:
    if placing a strong card here would flip 3+ cards:
      baseScore += 15 * ownerMultiplier  // Opportunity bonus

  return baseScore
```

**Implementation approach**: Extract patterns as features, weight them via machine learning (trained on self-play games), or hand-tune weights through experimentation.

**Impact**: 5–20% improvement in move quality when combined with search; diminishing returns beyond depth 6–7.

---

## Complete Pseudocode: Putting It All Together

Here's a full implementation skeleton integrating necessary optimizations:

```
class TripleTriadAI:

  function __init__():
    this.transpositionTable = {}
    this.killerMoves = {}  // Optional: killer move heuristic
    this.history = {}      // Optional: history heuristic
    this.cardStats = loadCardDatabase()

  function findBestMove(state, timeLimit):
    """Main entry point for AI decision."""
    startTime = now()
    bestMove = null

    // Iterative deepening with time control
    for depth in [1, 2, 3, 4, 5, 6, 7, 8]:
      if (now() - startTime) > timeLimit * 0.95:  // Reserve 5% for overhead
        break

      score, move = this.minimax(state, depth, -10000, +10000, true)

      if move is not null:
        bestMove = move
        print("Depth {depth}: score={score}, move={move}")

    return bestMove

  function minimax(state, depth, alpha, beta, maximizing):
    """Core minimax with alpha-beta pruning and transposition table."""

    // Transposition table lookup
    stateHash = zobristHash(state)
    if stateHash in this.transpositionTable:
      entry = this.transpositionTable[stateHash]
      if entry.depth >= depth:
        return (entry.score, entry.move)

    // Terminal conditions
    if state.moveCount == 9:
      // Board full: exact evaluation
      score = this.evaluateState(state)
      return (score, null)

    if depth == 0:
      // Depth limit reached: use heuristic evaluation
      // Optional: call quiescence() for unstable positions
      score = this.evaluateState(state)
      return (score, null)

    if maximizing:
      // AI's turn (maximize score)
      maxScore = -10000
      bestMove = null

      // Generate and order moves
      moves = this.orderMoves(this.generateMoves(state), depth, true)

      for move in moves:
        nextState = this.applyMove(state, move)
        score, _ = this.minimax(nextState, depth - 1, alpha, beta, false)

        if score > maxScore:
          maxScore = score
          bestMove = move

        alpha = max(alpha, maxScore)
        if beta <= alpha:
          // Beta cutoff: prune remaining moves
          if bestMove is not null:
            this.recordKillerMove(depth, bestMove)
            this.recordHistory(bestMove, depth)
          break

      // Store in transposition table
      this.transpositionTable[stateHash] = {
        score: maxScore,
        move: bestMove,
        depth: depth
      }

      return (maxScore, bestMove)

    else:
      // Opponent's turn (minimize AI's score)
      minScore = +10000
      bestMove = null

      moves = this.orderMoves(this.generateMoves(state), depth, false)

      for move in moves:
        nextState = this.applyMove(state, move)
        score, _ = this.minimax(nextState, depth - 1, alpha, beta, true)

        if score < minScore:
          minScore = score
          bestMove = move

        beta = min(beta, minScore)
        if beta <= alpha:
          // Alpha cutoff: prune remaining moves
          if bestMove is not null:
            this.recordKillerMove(depth, bestMove)
            this.recordHistory(bestMove, depth)
          break

      this.transpositionTable[stateHash] = {
        score: minScore,
        move: bestMove,
        depth: depth
      }

      return (minScore, bestMove)

  function orderMoves(moves, depth, maximizing):
    """Order moves to improve alpha-beta pruning."""

    scoredMoves = []

    for move in moves:
      nextState = this.applyMove(state, move)

      // Primary: capture count (moves that flip cards are usually strong)
      captureCount = this.countFlips(nextState, move)
      captureScore = 10000 * captureCount

      // Secondary: card strength
      card = this.cardStats[move.cardID]
      strengthScore = 100 * this.avgStrength(card)

      // Tertiary: position value (corners are harder to flip)
      cornerBonus = 50 if move.gridPosition in [0, 2, 6, 8] else 0
      centerBonus = 10 if move.gridPosition == 4 else 0

      // Optional: killer move heuristic
      killerBonus = 500 if move in this.killerMoves.get(depth, []) else 0

      // Optional: history heuristic
      historyBonus = this.history.get(
        (move.cardID, move.gridPosition), 0
      )

      totalScore = (
        captureScore + strengthScore +
        cornerBonus + centerBonus +
        killerBonus + historyBonus
      )

      scoredMoves.append((totalScore, move))

    // Sort descending
    return [move for score, move in sorted(scoredMoves, reverse=True)]

  function evaluateState(state):
    """Heuristic evaluation of board state."""

    score = 0
    player1Cards = countSetBits(state.owner1)
    player2Cards = countSetBits(state.owner2)

    // 1. Card ownership (dominant factor)
    score += 100 * (player1Cards - player2Cards)

    // 2. Card strength on board
    for cell in range(9):
      if state.grid[cell] is not empty:
        card = this.cardStats[state.grid[cell]]
        avgStr = this.avgStrength(card)

        if state.owner[cell] == 1:
          score += 3 * avgStr
        else:
          score -= 3 * avgStr

    // 3. Control of strategic positions
    cornerPositions = [0, 2, 6, 8]
    for pos in cornerPositions:
      if state.owner[pos] == 1:
        score += 8
      elif state.owner[pos] == 2:
        score -= 8

    centerPos = 4
    if state.owner[centerPos] == 1:
      score += 5
    elif state.owner[centerPos] == 2:
      score -= 5

    // 4. Hand strength (cards not yet played)
    hand1Strength = 0
    hand2Strength = 0
    for cardID in range(20):
      if state.hand1 & (1 << cardID):
        hand1Strength += this.avgStrength(this.cardStats[cardID])
      if state.hand2 & (1 << cardID):
        hand2Strength += this.avgStrength(this.cardStats[cardID])

    score += 0.5 * (hand1Strength - hand2Strength)

    // Optional: pattern bonuses (pattern recognition)
    score += this.evaluatePatterns(state)

    return score

  function generateMoves(state):
    """Generate all legal moves for current player."""

    moves = []
    hand = state.hand1 if state.currentPlayer == 1 else state.hand2

    // Iterate through player's cards
    for cardID in range(20):
      if not (hand & (1 << cardID)):
        continue  // Player doesn't have this card

      // Try placing on each empty cell
      for cellPos in range(9):
        if state.grid[cellPos] == empty:
          moves.append({
            cardID: cardID,
            gridPosition: cellPos
          })

    return moves

  function applyMove(state, move):
    """Create new state after applying move."""

    newState = state.copy()
    cardID = move.cardID
    pos = move.gridPosition
    currentPlayer = state.currentPlayer

    // Place card
    newState.grid[pos] = cardID
    newState.owner[pos] = currentPlayer

    // Remove card from hand
    if currentPlayer == 1:
      newState.hand1 &= ~(1 << cardID)
    else:
      newState.hand2 &= ~(1 << cardID)

    // Check adjacent cells for captures
    adjacentPositions = this.getAdjacentPositions(pos)
    for adjPos in adjacentPositions:
      if newState.grid[adjPos] is not empty:
        adjCard = this.cardStats[newState.grid[adjPos]]
        currentCard = this.cardStats[cardID]

        // Determine direction and compare strengths
        direction = this.getDirection(pos, adjPos)
        if this.compareStrengths(currentCard, adjCard, direction,
                                  newState.owner[adjPos]):
          // Flip the adjacent card
          newState.owner[adjPos] = currentPlayer

    // Update metadata
    newState.moveCount += 1
    newState.currentPlayer = 3 - currentPlayer  // Toggle: 1→2, 2→1

    return newState

  function zobristHash(state):
    """Generate hash for transposition table."""

    hash = 0

    // Hash grid contents
    for pos in range(9):
      if state.grid[pos] is not empty:
        cardID = state.grid[pos]
        ownerID = state.owner[pos]
        hash ^= zobristTable[pos][cardID][ownerID]

    // Hash hands (optional: for deeper precision)
    for playerID in [1, 2]:
      hand = state.hand1 if playerID == 1 else state.hand2
      for cardID in range(20):
        if hand & (1 << cardID):
          hash ^= zobristTableHand[playerID][cardID]

    // Hash current player
    hash ^= zobristPlayer[state.currentPlayer]

    return hash

  // Optional helper methods for advanced features

  function recordKillerMove(depth, move):
    """Killer move heuristic: record moves that cause cutoffs."""
    if depth not in this.killerMoves:
      this.killerMoves[depth] = []
    this.killerMoves[depth].append(move)

  function recordHistory(move, depth):
    """History heuristic: weight moves by historical success."""
    key = (move.cardID, move.gridPosition)
    this.history[key] = this.history.get(key, 0) + (1 << depth)
```

---

## Summary Table: Optimization Impact & Implementation Effort

| Optimization               | Necessary? | Time Reduction                    | Implementation Difficulty | Recommended Depth |
| -------------------------- | ---------- | --------------------------------- | ------------------------- | ----------------- |
| Alpha-beta pruning         | **Yes**    | 70–80%                            | Easy                      | 5–7               |
| Move ordering              | **Yes**    | 60–70% (combined with alpha-beta) | Easy                      | 5–7               |
| Transposition table        | **Yes**    | 30–50%                            | Medium                    | 6–8               |
| Iterative deepening        | **Yes**    | ~10% overhead                     | Easy                      | Variable          |
| Quiescence search          | No         | 5–15% quality gain                | Medium                    | 6–7               |
| Killer moves               | No         | 10–20%                            | Medium                    | 6–8               |
| History heuristic          | No         | 10–20%                            | Medium                    | 6–8               |
| Aspiration windows         | No         | 20–40%                            | Hard                      | 7–9               |
| Principal Variation Search | No         | 10–30%                            | Hard                      | 7–9               |
| Endgame tablebases         | No         | Perfect endgame                   | Easy (precompute)         | Whole game        |
| Pattern recognition        | No         | 5–20%                             | Very hard                 | 8+                |

---

## Practical Recommendations

**For a strong, playable AI**:

1. Implement **alpha-beta pruning + move ordering + transposition table + iterative deepening** (gives ~5–7 ply search in reasonable time)
2. Use the **enhanced evaluation function** with card count, strength, and positional bonuses
3. Target **2–3 second decision time** per move

**For a competitive AI**: 4. Add **killer moves** and **history heuristic** 5. Implement **quiescence search** for unstable positions 6. Fine-tune evaluation weights via self-play 7. Add **endgame tablebases** for the final 3–4 moves 8. Target **5–10 ply search**

**For a world-class AI** (diminishing returns): 9. Add **aspiration windows** and **PVS** 10. Implement **pattern recognition** trained on expert games 11. Use **neural network evaluation** instead of hand-crafted heuristics 12. Consider **Monte Carlo Tree Search** as an alternative to minimax

This plan balances **theoretical soundness, practical performance, and implementation complexity**.
