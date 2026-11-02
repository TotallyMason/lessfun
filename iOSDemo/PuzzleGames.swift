import Combine
import SwiftUI

// MARK: - Memory Match

private struct MemoryMatchCard: Identifiable {
    let id = UUID()
    let symbol: String
    let tint: Color
    var isFaceUp = false
    var isMatched = false
}

struct MemoryMatchView: View {
    @AppStorage("lessfun.best.memory") private var bestMoves = 0
    @State private var difficulty: Difficulty = .normal
    @State private var cards: [MemoryMatchCard] = []
    @State private var firstPick: Int?
    @State private var moves = 0
    @State private var elapsed = 0
    @State private var hasStarted = false
    @State private var isBusy = false
    @State private var won = false
    @State private var shakeIndices: [Int] = []

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 4)

    private let symbolPool: [(symbol: String, tint: Color)] = [
        ("leaf.fill", .green),
        ("bolt.fill", .yellow),
        ("flame.fill", .orange),
        ("drop.fill", .blue),
        ("star.fill", .purple),
        ("moon.fill", .indigo),
        ("cloud.fill", .cyan),
        ("snowflake", .teal)
    ]

    private var pairCount: Int {
        switch difficulty {
        case .chill: return 4
        case .normal: return 6
        case .brutal: return 8
        }
    }

    private var matchedPairs: Int {
        cards.filter(\.isMatched).count / 2
    }

    private var stars: Int {
        if moves <= Int(Double(pairCount) * 1.6) { return 3 }
        if moves <= Int(Double(pairCount) * 2.4) { return 2 }
        return 1
    }

    var body: some View {
        GameShell(game: .memory) {
            DifficultyPicker(selection: $difficulty)

            HStack(spacing: 10) {
                ScoreTile(label: "Moves", value: "\(moves)", tint: .pink)
                ScoreTile(label: "Pairs", value: "\(matchedPairs)/\(pairCount)", tint: .purple)
                ScoreTile(label: "Time", value: formatClock(elapsed), tint: .blue)
                ScoreTile(label: "Best", value: bestMoves > 0 ? "\(bestMoves) mv" : "—", tint: .green)
            }

            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(cards.indices, id: \.self) { index in
                    Button {
                        flip(index)
                    } label: {
                        cardView(index)
                    }
                    .buttonStyle(.plain)
                }
            }

            Button("Shuffle") {
                reset()
            }
            .buttonStyle(FunButtonStyle(color: .pink))

            Text("Flip two cards. Fewer moves means more stars.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .onAppear {
            if cards.isEmpty {
                reset()
            }
        }
        .onChange(of: difficulty) { _, _ in reset() }
        .onReceive(timer) { _ in
            if hasStarted && !won {
                elapsed += 1
            }
        }
        .resultOverlay(won) {
            ResultCard(
                symbol: "star.fill",
                title: "Board cleared",
                subtitle: "\(stars) stars · \(moves) moves · \(formatClock(elapsed))",
                tint: .pink,
                primaryTitle: "Play again",
                primaryAction: reset
            )
        }
    }

    private func cardView(_ index: Int) -> some View {
        let card = cards[index]
        let showingFace = card.isFaceUp || card.isMatched

        return ZStack {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(
                    card.isMatched
                        ? card.tint.opacity(0.22)
                        : Color.primary.opacity(0.055)
                )

            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(
                    card.isMatched ? card.tint.opacity(0.65) : Color.white.opacity(0.06),
                    lineWidth: 1
                )

            if showingFace {
                Image(systemName: card.symbol)
                    .font(.system(size: 27, weight: .semibold))
                    .foregroundStyle(card.tint)
                    .transition(.scale.combined(with: .opacity))
            } else {
                Image(systemName: "questionmark")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.secondary.opacity(0.45))
            }
        }
        .frame(height: 72)
        .scaleEffect(card.isMatched ? 0.94 : 1)
        .offset(x: shakeIndices.contains(index) ? 4 : 0)
        .animation(.default.repeatCount(2, autoreverses: true), value: shakeIndices)
    }

    private func reset() {
        let pairs = symbolPool.prefix(pairCount).flatMap { entry in
            [
                MemoryMatchCard(symbol: entry.symbol, tint: entry.tint),
                MemoryMatchCard(symbol: entry.symbol, tint: entry.tint)
            ]
        }

        cards = pairs.shuffled()
        firstPick = nil
        moves = 0
        elapsed = 0
        hasStarted = false
        isBusy = false
        won = false
        shakeIndices = []
    }

    private func flip(_ index: Int) {
        guard !isBusy, !won, cards.indices.contains(index) else { return }
        guard !cards[index].isFaceUp, !cards[index].isMatched else { return }

        hasStarted = true

        withAnimation(.snappy(duration: 0.2)) {
            cards[index].isFaceUp = true
        }

        guard let first = firstPick else {
            firstPick = index
            return
        }

        moves += 1

        if cards[first].symbol == cards[index].symbol {
            withAnimation(.snappy) {
                cards[first].isMatched = true
                cards[index].isMatched = true
            }
            firstPick = nil

            if cards.allSatisfy(\.isMatched) {
                won = true
                bestMoves = bestMoves == 0 ? moves : min(bestMoves, moves)
            }
        } else {
            isBusy = true
            let a = first
            let b = index

            withAnimation(.snappy) {
                shakeIndices = [a, b]
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
                withAnimation(.snappy) {
                    cards[a].isFaceUp = false
                    cards[b].isFaceUp = false
                    shakeIndices = []
                }
                firstPick = nil
                isBusy = false
            }
        }
    }
}

// MARK: - Tic-Tac-Toe

struct TicTacToeView: View {
    @AppStorage("lessfun.ttt.wins") private var wins = 0
    @AppStorage("lessfun.ttt.losses") private var losses = 0
    @AppStorage("lessfun.ttt.draws") private var draws = 0

    @State private var difficulty: Difficulty = .normal
    @State private var board: [String?] = Array(repeating: nil, count: 9)
    @State private var isPlayerTurn = true
    @State private var thinking = false
    @State private var gameOver = false
    @State private var message = "Your move"
    @State private var winningLine: [Int] = []

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 3)

    var body: some View {
        GameShell(game: .ticTacToe) {
            DifficultyPicker(selection: $difficulty)
                .disabled(thinking)
                .onChange(of: difficulty) { _, _ in startRound() }

            HStack(spacing: 10) {
                ScoreTile(label: "You", value: "\(wins)", tint: .indigo)
                ScoreTile(label: "Robot", value: "\(losses)", tint: .pink)
                ScoreTile(label: "Draws", value: "\(draws)", tint: .secondary)
            }

            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(0..<9, id: \.self) { index in
                    Button {
                        play(index)
                    } label: {
                        cell(index)
                    }
                    .buttonStyle(.plain)
                    .disabled(board[index] != nil || !isPlayerTurn || gameOver)
                }
            }

            HStack(spacing: 8) {
                Image(systemName: thinking ? "cpu" : (gameOver ? "flag.checkered" : "hand.point.up.left.fill"))
                    .foregroundStyle(.indigo)
                    .symbolEffect(.pulse, options: .repeating, isActive: thinking)

                Text(message)
                    .font(.subheadline.weight(.medium))

                Spacer()
            }
            .padding(12)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))

            HStack(spacing: 10) {
                Button("New round") { startRound() }
                    .buttonStyle(FunButtonStyle(color: .indigo, compact: true))

                Text(difficulty == .brutal ? "Unbeatable robot" : "Beatable robot")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .resultOverlay(gameOver) {
            ResultCard(
                symbol: message.contains("You") ? "trophy.fill" : (message == "Draw" ? "equal.circle.fill" : "cpu.fill"),
                title: message,
                subtitle: "You \(wins) · Robot \(losses) · Draws \(draws)",
                tint: message.contains("You") ? .indigo : .pink,
                primaryTitle: "Next round",
                primaryAction: startRound
            )
        }
    }

    private func cell(_ index: Int) -> some View {
        let mark = board[index]
        let tint = mark == "X" ? Color.indigo : Color.pink
        let highlighted = winningLine.contains(index)

        return ZStack {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(mark == nil ? Color.primary.opacity(0.05) : tint.opacity(0.14))

            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(highlighted ? tint : Color.white.opacity(0.06), lineWidth: highlighted ? 2 : 1)

            if let mark {
                Image(systemName: mark == "X" ? "xmark" : "circle")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundStyle(tint)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .frame(height: 84)
        .shadow(color: highlighted ? tint.opacity(0.4) : .clear, radius: 10)
    }

    private func startRound() {
        withAnimation(.snappy) {
            board = Array(repeating: nil, count: 9)
            winningLine = []
            gameOver = false
            isPlayerTurn = true
            thinking = false
            message = "Your move"
        }
    }

    private func play(_ index: Int) {
        guard isPlayerTurn, !gameOver, board[index] == nil else { return }

        withAnimation(.snappy) {
            board[index] = "X"
        }

        if finishIfNeeded() { return }

        isPlayerTurn = false
        thinking = true
        message = "Robot is thinking"

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            aiTurn()
        }
    }

    private func aiTurn() {
        guard !gameOver else { return }

        let move: Int?

        switch difficulty {
        case .chill:
            move = board.indices.filter { board[$0] == nil }.randomElement()
        case .normal:
            move = tacticalMove()
        case .brutal:
            move = minimaxMove()
        }

        if let move {
            withAnimation(.snappy) {
                board[move] = "O"
            }
        }

        thinking = false

        if finishIfNeeded() { return }

        withAnimation(.snappy) {
            isPlayerTurn = true
            message = "Your move"
        }
    }

    private func tacticalMove() -> Int? {
        if let win = winningMove(for: "O") { return win }
        if let block = winningMove(for: "X") { return block }
        if board[4] == nil { return 4 }

        let corners = [0, 2, 6, 8].filter { board[$0] == nil }
        if let corner = corners.randomElement() { return corner }

        return board.indices.filter { board[$0] == nil }.randomElement()
    }

    private func minimaxMove() -> Int? {
        var bestScore = -1000
        var bestMove: Int?

        for index in board.indices where board[index] == nil {
            var copy = board
            copy[index] = "O"
            let score = minimax(copy, maximizing: false, depth: 1)

            if score > bestScore {
                bestScore = score
                bestMove = index
            }
        }

        return bestMove
    }

    private func minimax(_ cells: [String?], maximizing: Bool, depth: Int) -> Int {
        if let result = winner(cells) {
            return result.mark == "O" ? 10 - depth : depth - 10
        }

        if !cells.contains(where: { $0 == nil }) {
            return 0
        }

        if maximizing {
            var value = -1000
            for index in cells.indices where cells[index] == nil {
                var copy = cells
                copy[index] = "O"
                value = max(value, minimax(copy, maximizing: false, depth: depth + 1))
            }
            return value
        } else {
            var value = 1000
            for index in cells.indices where cells[index] == nil {
                var copy = cells
                copy[index] = "X"
                value = min(value, minimax(copy, maximizing: true, depth: depth + 1))
            }
            return value
        }
    }

    private func finishIfNeeded() -> Bool {
        if let result = winner(board) {
            winningLine = result.line
            gameOver = true
            isPlayerTurn = false

            withAnimation(.snappy) {
                if result.mark == "X" {
                    wins += 1
                    message = "You win"
                } else {
                    losses += 1
                    message = "Robot wins"
                }
            }
            return true
        }

        if !board.contains(where: { $0 == nil }) {
            withAnimation(.snappy) {
                draws += 1
                gameOver = true
                message = "Draw"
            }
            return true
        }

        return false
    }

    private func winningMove(for player: String) -> Int? {
        for index in board.indices where board[index] == nil {
            var copy = board
            copy[index] = player
            if winner(copy)?.mark == player { return index }
        }
        return nil
    }

    private func winner(_ cells: [String?]) -> (mark: String, line: [Int])? {
        let lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ]

        for line in lines {
            if let first = cells[line[0]], cells[line[1]] == first, cells[line[2]] == first {
                return (first, line)
            }
        }

        return nil
    }
}

// MARK: - Guess the Number

private enum GuessDirection {
    case higher
    case lower

    var symbol: String {
        switch self {
        case .higher: return "arrow.up"
        case .lower: return "arrow.down"
        }
    }

    var tint: Color {
        switch self {
        case .higher: return .blue
        case .lower: return .orange
        }
    }
}

private struct GuessEntry: Identifiable {
    let id = UUID()
    let value: Int
    let direction: GuessDirection
}

struct GuessNumberView: View {
    @AppStorage("lessfun.best.guessNumber") private var best = 0
    @State private var difficulty: Difficulty = .normal
    @State private var target = Int.random(in: 1...100)
    @State private var input = ""
    @State private var attemptsUsed = 0
    @State private var history: [GuessEntry] = []
    @State private var message = "I picked a number. Find it."
    @State private var won = false
    @State private var lost = false

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 3)

    private var range: ClosedRange<Int> {
        switch difficulty {
        case .chill: return 1...50
        case .normal: return 1...100
        case .brutal: return 1...500
        }
    }

    private var maxAttempts: Int {
        switch difficulty {
        case .chill: return 10
        case .normal: return 8
        case .brutal: return 7
        }
    }

    private var attemptsLeft: Int {
        max(0, maxAttempts - attemptsUsed)
    }

    private var proximity: Double {
        guard let last = history.first else { return 0 }
        let span = Double(range.upperBound - range.lowerBound)
        let distance = Double(abs(target - last.value))
        return max(0, 1 - distance / span)
    }

    private var proximityTint: Color {
        if proximity > 0.8 { return .red }
        if proximity > 0.55 { return .orange }
        if proximity > 0.3 { return .yellow }
        return .blue
    }

    var body: some View {
        GameShell(game: .guessNumber) {
            DifficultyPicker(selection: $difficulty)

            HStack(spacing: 10) {
                ScoreTile(label: "Range", value: "1–\(range.upperBound)", tint: .blue)
                ScoreTile(label: "Tries", value: "\(attemptsLeft)", tint: attemptsLeft <= 2 ? .red : .green)
                ScoreTile(label: "Best", value: best > 0 ? "\(best) tries" : "—", tint: .purple)
            }

            VStack(spacing: 10) {
                Text(input.isEmpty ? "—" : input)
                    .font(.system(size: 46, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(input.isEmpty ? Color.secondary.opacity(0.4) : Color.primary)
                    .contentTransition(.numericText())
                    .frame(maxWidth: .infinity)
                    .frame(height: 76)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                HStack(spacing: 8) {
                    Image(systemName: proximity > 0.55 ? "flame.fill" : "thermometer.medium")
                        .foregroundStyle(proximityTint)
                    Text("Proximity")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    ArcadeProgressBar(progress: proximity, tint: proximityTint, height: 8)
                }

                Text(message)
                    .font(.subheadline.weight(.medium))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 42)
                    .padding(.horizontal, 12)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(1...9, id: \.self) { digit in
                    Button {
                        press(digit)
                    } label: {
                        keypadLabel(Text("\(digit)"))
                    }
                    .buttonStyle(.plain)
                }

                Button {
                    deleteLast()
                } label: {
                    keypadLabel(Image(systemName: "delete.left"), tint: .orange)
                }
                .buttonStyle(.plain)

                Button {
                    press(0)
                } label: {
                    keypadLabel(Text("0"))
                }
                .buttonStyle(.plain)

                Button {
                    submit()
                } label: {
                    keypadLabel(Image(systemName: "checkmark"), tint: .white)
                        .background(
                            LinearGradient(
                                colors: [.blue, .indigo],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                        )
                }
                .buttonStyle(.plain)
                .disabled(input.isEmpty || won || lost)
            }

            if !history.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(history) { entry in
                            HStack(spacing: 3) {
                                Text("\(entry.value)")
                                    .monospacedDigit()
                                Image(systemName: entry.direction.symbol)
                            }
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(entry.direction.tint)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 5)
                            .background(entry.direction.tint.opacity(0.12), in: Capsule())
                        }
                    }
                }
            }
        }
        .onChange(of: difficulty) { _, _ in reset() }
        .resultOverlay(won || lost) {
            ResultCard(
                symbol: won ? "checkmark.seal.fill" : "xmark.octagon.fill",
                title: won ? "Got it" : "Out of tries",
                subtitle: won
                    ? "\(target) in \(attemptsUsed) \(attemptsUsed == 1 ? "try" : "tries")"
                    : "The number was \(target).",
                tint: won ? .blue : .red,
                primaryTitle: "New number",
                primaryAction: reset
            )
        }
    }

    private func keypadLabel<Content: View>(_ content: Content, tint: Color = .primary) -> some View {
        content
            .font(.title2.weight(.semibold))
            .foregroundStyle(tint)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func press(_ digit: Int) {
        guard !won, !lost else { return }
        guard input.count < 3 else { return }

        if input == "0" {
            input = ""
        }

        input += String(digit)
    }

    private func deleteLast() {
        guard !input.isEmpty else { return }
        input.removeLast()
    }

    private func submit() {
        guard let guess = Int(input), range.contains(guess), !won, !lost else { return }
        guard !history.contains(where: { $0.value == guess }) else {
            message = "You already tried \(guess)."
            input = ""
            return
        }

        attemptsUsed += 1
        input = ""

        if guess == target {
            won = true
            best = best == 0 ? attemptsUsed : min(best, attemptsUsed)
            message = "Correct."
            return
        }

        let direction: GuessDirection = guess < target ? .higher : .lower
        history.insert(GuessEntry(value: guess, direction: direction), at: 0)

        if attemptsUsed >= maxAttempts {
            lost = true
            message = "No tries left."
        } else {
            message = direction == .higher
                ? "\(guess) is too low. Go higher."
                : "\(guess) is too high. Go lower."
        }
    }

    private func reset() {
        target = Int.random(in: range)
        input = ""
        attemptsUsed = 0
        history = []
        message = "I picked a number. Find it."
        won = false
        lost = false
    }
}
