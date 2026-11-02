import SwiftUI

// MARK: - Higher / Lower

private struct PlayingCard: Identifiable, Equatable {
    let id = UUID()
    let rank: Int
    let suit: Int

    var rankName: String {
        ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][rank - 1]
    }

    var suitSymbol: String {
        ["suit.spade.fill", "suit.heart.fill", "suit.diamond.fill", "suit.club.fill"][suit]
    }

    var isRed: Bool {
        suit == 1 || suit == 2
    }
}

private enum HLRoundOutcome {
    case win
    case loss
    case push

    var tint: Color {
        switch self {
        case .win: return .green
        case .loss: return .red
        case .push: return .secondary
        }
    }
}

struct HigherLowerView: View {
    @AppStorage("lessfun.best.higherLower") private var bestScore = 0
    @State private var difficulty: Difficulty = .normal
    @State private var deck: [PlayingCard] = []
    @State private var current: PlayingCard?
    @State private var next: PlayingCard?
    @State private var revealed = false
    @State private var lives = 3
    @State private var streak = 0
    @State private var score = 0
    @State private var gameOver = false
    @State private var message = "Will the next card be higher or lower?"
    @State private var outcome: HLRoundOutcome?

    private var maxLives: Int {
        switch difficulty {
        case .chill: return 5
        case .normal: return 3
        case .brutal: return 2
        }
    }

    var body: some View {
        GameShell(game: .higherLower) {
            DifficultyPicker(selection: $difficulty)

            HStack(spacing: 10) {
                ScoreTile(label: "Lives", value: "\(max(0, lives))", tint: .red)
                ScoreTile(label: "Streak", value: "\(streak)", tint: .purple)
                ScoreTile(label: "Score", value: "\(score)", tint: .green)
                ScoreTile(label: "Best", value: "\(bestScore)", tint: .orange)
            }

            HStack(spacing: 14) {
                cardView(current, faceUp: true)

                Image(systemName: "arrow.right")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.secondary)

                cardView(next, faceUp: revealed)
            }
            .frame(maxWidth: .infinity)

            HStack(spacing: 8) {
                Image(systemName: outcomeSymbol)
                    .foregroundStyle(outcome?.tint ?? Color.secondary)

                Text(message)
                    .font(.subheadline.weight(.medium))
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 46)
            .padding(.horizontal, 10)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

            HStack(spacing: 10) {
                Button {
                    guess(higher: false)
                } label: {
                    Label("Lower", systemImage: "arrow.down")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(FunButtonStyle(color: .teal))

                Button {
                    guess(higher: true)
                } label: {
                    Label("Higher", systemImage: "arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(FunButtonStyle(color: .purple))
            }
            .disabled(revealed || gameOver)
            .opacity(revealed || gameOver ? 0.55 : 1)

            HStack {
                Text("\(deck.count) cards left")
                Spacer()
                Text("Streak of 5 earns a life")
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
        .onAppear {
            if deck.isEmpty && current == nil {
                reset()
            }
        }
        .onChange(of: difficulty) { _, _ in reset() }
        .resultOverlay(gameOver) {
            ResultCard(
                symbol: "suit.spade.fill",
                title: "Deck wins",
                subtitle: "\(score) points · best streak \(streak) · record \(bestScore)",
                tint: .purple,
                primaryTitle: "Deal again",
                primaryAction: reset
            )
        }
    }

    private var outcomeSymbol: String {
        switch outcome {
        case .win: return "checkmark.circle.fill"
        case .loss: return "xmark.circle.fill"
        case .push: return "equal.circle.fill"
        case nil: return "questionmark.circle"
        }
    }

    private func cardView(_ card: PlayingCard?, faceUp: Bool) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(faceUp && card != nil ? Color.white : Color.purple.opacity(0.28))

            if let card, faceUp {
                VStack(alignment: .leading, spacing: 0) {
                    Text(card.rankName)
                        .font(.system(size: 28, weight: .black, design: .rounded))
                    Image(systemName: card.suitSymbol)
                        .font(.title3)

                    Spacer()

                    HStack {
                        Spacer()
                        VStack(spacing: 2) {
                            Text(card.rankName)
                                .font(.system(size: 22, weight: .bold, design: .rounded))
                            Image(systemName: card.suitSymbol)
                        }
                    }
                }
                .foregroundStyle(card.isRed ? Color.red : Color.black)
                .padding(12)
                .transition(.scale.combined(with: .opacity))
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "suit.club.fill")
                        .font(.title2)
                    Image(systemName: "questionmark")
                        .font(.headline.weight(.bold))
                }
                .foregroundStyle(.white.opacity(0.75))
            }
        }
        .frame(width: 128, height: 176)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(.white.opacity(0.2))
        )
        .shadow(color: .black.opacity(0.22), radius: 14, y: 8)
        .scaleEffect(x: faceUp ? 1 : 0.94, y: 1)
        .animation(.spring(duration: 0.35), value: faceUp)
    }

    private func makeDeck() -> [PlayingCard] {
        (0..<4).flatMap { suit in
            (1...13).map { rank in
                PlayingCard(rank: rank, suit: suit)
            }
        }
    }

    private func reset() {
        var fresh = makeDeck().shuffled()
        current = fresh.popLast()
        deck = fresh
        next = nil
        revealed = false
        gameOver = false
        lives = maxLives
        streak = 0
        score = 0
        outcome = nil
        message = "Will the next card be higher or lower?"
    }

    private func guess(higher: Bool) {
        guard !revealed, !gameOver, let currentCard = current else { return }

        if deck.isEmpty {
            deck = makeDeck().shuffled()
        }

        guard let drawn = deck.popLast() else { return }

        next = drawn
        withAnimation(.spring(duration: 0.35)) {
            revealed = true
        }

        if drawn.rank == currentCard.rank {
            outcome = .push
            message = "Push. Same rank, no cost."
        } else if (drawn.rank > currentCard.rank) == higher {
            outcome = .win
            streak += 1
            let points = 10 * streak * difficulty.scoreMultiplier
            score += points

            if streak % 5 == 0 && lives < maxLives {
                lives += 1
                message = "Correct +\(points). Bonus life."
            } else {
                message = "Correct +\(points) · streak \(streak)."
            }
        } else {
            outcome = .loss
            lives -= 1
            streak = 0
            message = lives > 0
                ? "Wrong. \(lives) \(lives == 1 ? "life" : "lives") left."
                : "Wrong. No lives left."
        }

        let ending = lives <= 0

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
            withAnimation(.snappy) {
                current = drawn
                next = nil
                revealed = false
            }

            if deck.count < 6 {
                deck = makeDeck().shuffled()
            }

            if ending {
                bestScore = max(bestScore, score)
                withAnimation(.snappy) {
                    gameOver = true
                }
            }
        }
    }
}

// MARK: - Dice Roller

struct DiceRollerView: View {
    @AppStorage("lessfun.dice.chips") private var chips = 100
    @AppStorage("lessfun.best.dice") private var bestChips = 0
    @State private var difficulty: Difficulty = .normal
    @State private var targetSum = 7
    @State private var dice = [1, 2]
    @State private var isRolling = false
    @State private var streak = 0
    @State private var message = "Pick a total, then roll."

    private let bet = 10

    private var diceCount: Int {
        difficulty == .brutal ? 3 : 2
    }

    private var minSum: Int { diceCount + 1 }
    private var maxSum: Int { diceCount * 6 }

    var body: some View {
        GameShell(game: .dice) {
            DifficultyPicker(selection: $difficulty)
                .disabled(isRolling)

            HStack(spacing: 10) {
                ScoreTile(label: "Chips", value: "\(chips)", tint: .red)
                ScoreTile(label: "Target", value: "\(targetSum)", tint: .orange)
                ScoreTile(label: "Streak", value: "\(streak)", tint: .green)
                ScoreTile(label: "Best", value: "\(bestChips)", tint: .purple)
            }

            HStack(spacing: 14) {
                ForEach(dice.indices, id: \.self) { index in
                    DieView(value: dice[index], tint: .red)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)

            HStack(spacing: 8) {
                Image(systemName: "text.bubble.fill")
                    .foregroundStyle(.red)
                Text(message)
                    .font(.subheadline.weight(.medium))
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 44)
            .padding(.horizontal, 10)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

            Menu {
                ForEach(minSum...maxSum, id: \.self) { sum in
                    Button {
                        targetSum = sum
                    } label: {
                        Label("\(sum)", systemImage: sum == targetSum ? "checkmark" : "circle")
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "target")
                        .foregroundStyle(.orange)
                    Text("Target total: \(targetSum)")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .disabled(isRolling)

            Button {
                roll()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: isRolling ? "arrow.triangle.2.circlepath" : "dice.fill")
                    Text(isRolling ? "Rolling…" : "Roll · \(bet) chips")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(FunButtonStyle(color: .red))
            .disabled(isRolling || chips < bet)

            VStack(spacing: 4) {
                Text("Exact total pays \(diceCount == 3 ? "15x" : "6x") your bet.")
                Text("Off by one returns your bet.")
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)

            Button("Reset chips to 100") {
                chips = 100
                streak = 0
                message = "Chips topped up."
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .disabled(isRolling)
        }
        .onAppear {
            dice = Array(repeating: 1, count: diceCount)
        }
        .onChange(of: difficulty) { _, _ in
            withAnimation(.snappy) {
                targetSum = min(max(targetSum, minSum), maxSum)
                dice = Array(repeating: 1, count: diceCount)
                message = "Pick a total, then roll."
            }
        }
        .resultOverlay(chips < bet && !isRolling) {
            ResultCard(
                symbol: "creditcard.fill",
                title: "Out of chips",
                subtitle: "The house always wins. Best stack: \(bestChips).",
                tint: .red,
                primaryTitle: "Reset to 100",
                primaryAction: {
                    chips = 100
                    streak = 0
                    message = "Chips topped up."
                }
            )
        }
    }

    private func roll() {
        guard !isRolling, chips >= bet else { return }

        chips -= bet
        isRolling = true
        message = "Rolling…"
        animateRoll(remaining: 9)
    }

    private func animateRoll(remaining: Int) {
        guard remaining > 0 else {
            finishRoll()
            return
        }

        withAnimation(.snappy(duration: 0.08)) {
            dice = (0..<diceCount).map { _ in Int.random(in: 1...6) }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
            animateRoll(remaining: remaining - 1)
        }
    }

    private func finishRoll() {
        let total = dice.reduce(0, +)
        let difference = abs(total - targetSum)

        if difference == 0 {
            let payout = bet * (diceCount == 3 ? 15 : 6)
            chips += payout
            streak += 1
            message = "Exact \(total). +\(payout) chips."
        } else if difference == 1 {
            chips += bet
            streak = 0
            message = "Off by one (\(total)). Bet returned."
        } else {
            streak = 0
            message = "Rolled \(total). Target was \(targetSum)."
        }

        bestChips = max(bestChips, chips)
        isRolling = false
    }
}

private struct DieView: View {
    let value: Int
    let tint: Color

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(.white)
                .shadow(color: .black.opacity(0.18), radius: 10, y: 6)

            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(.black.opacity(0.06))

            GeometryReader { proxy in
                ForEach(Array(dots.enumerated()), id: \.offset) { _, point in
                    Circle()
                        .fill(tint)
                        .frame(width: 12, height: 12)
                        .position(
                            x: proxy.size.width / 2 + point.x * proxy.size.width * 0.28,
                            y: proxy.size.height / 2 + point.y * proxy.size.height * 0.28
                        )
                }
            }
        }
        .frame(width: 86, height: 86)
        .rotationEffect(.degrees(Double(value) * 2))
        .animation(.snappy, value: value)
    }

    private var dots: [CGPoint] {
        switch value {
        case 1:
            return [.zero]
        case 2:
            return [CGPoint(x: -1, y: -1), CGPoint(x: 1, y: 1)]
        case 3:
            return [CGPoint(x: -1, y: -1), .zero, CGPoint(x: 1, y: 1)]
        case 4:
            return [
                CGPoint(x: -1, y: -1), CGPoint(x: 1, y: -1),
                CGPoint(x: -1, y: 1), CGPoint(x: 1, y: 1)
            ]
        case 5:
            return [
                CGPoint(x: -1, y: -1), CGPoint(x: 1, y: -1), .zero,
                CGPoint(x: -1, y: 1), CGPoint(x: 1, y: 1)
            ]
        default:
            return [
                CGPoint(x: -1, y: -1), CGPoint(x: 1, y: -1),
                CGPoint(x: -1, y: 0), CGPoint(x: 1, y: 0),
                CGPoint(x: -1, y: 1), CGPoint(x: 1, y: 1)
            ]
        }
    }
}

// MARK: - Coin Flip

private enum CoinSide: String, CaseIterable, Identifiable {
    case heads
    case tails

    var id: String { rawValue }

    var title: String {
        switch self {
        case .heads: return "Heads"
        case .tails: return "Tails"
        }
    }

    var symbol: String {
        switch self {
        case .heads: return "crown.fill"
        case .tails: return "moon.stars.fill"
        }
    }

    var tint: Color {
        switch self {
        case .heads: return .orange
        case .tails: return .indigo
        }
    }

    var opposite: CoinSide {
        self == .heads ? .tails : .heads
    }
}

struct CoinFlipView: View {
    @AppStorage("lessfun.best.coinFlip") private var bestStreak = 0
    @AppStorage("lessfun.coin.score") private var score = 0
    @State private var difficulty: Difficulty = .normal
    @State private var pick: CoinSide = .heads
    @State private var result: CoinSide?
    @State private var streak = 0
    @State private var lives = 3
    @State private var isFlipping = false
    @State private var spin = 0.0
    @State private var history: [CoinSide] = []
    @State private var message = "Pick a side and flip."

    private var maxLives: Int {
        switch difficulty {
        case .chill: return 5
        case .normal: return 3
        case .brutal: return 1
        }
    }

    var body: some View {
        GameShell(game: .coinFlip) {
            DifficultyPicker(selection: $difficulty)
                .disabled(isFlipping)

            HStack(spacing: 10) {
                ScoreTile(label: "Lives", value: "\(max(0, lives))", tint: .red)
                ScoreTile(label: "Streak", value: "\(streak)", tint: .orange)
                ScoreTile(label: "Best", value: "\(bestStreak)", tint: .purple)
                ScoreTile(label: "Score", value: "\(score)", tint: .green)
            }

            ZStack {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [.yellow.opacity(0.95), .orange, .brown],
                            center: UnitPoint(x: 0.35, y: 0.3),
                            startRadius: 8,
                            endRadius: 110
                        )
                    )
                    .frame(width: 178, height: 178)
                    .shadow(color: .orange.opacity(0.45), radius: 24, y: 12)

                Circle()
                    .strokeBorder(.white.opacity(0.45), lineWidth: 3)
                    .frame(width: 156, height: 156)

                Image(systemName: (result ?? pick).symbol)
                    .font(.system(size: 56, weight: .bold))
                    .foregroundStyle(.white)
                    .rotation3DEffect(.degrees(spin), axis: (x: 0, y: 1, z: 0))
            }
            .frame(height: 210)
            .scaleEffect(isFlipping ? 1.04 : 1)
            .animation(.easeInOut(duration: 0.3).repeatForever(autoreverses: true), value: isFlipping)

            HStack(spacing: 10) {
                ForEach(CoinSide.allCases) { side in
                    Button {
                        withAnimation(.snappy) {
                            pick = side
                            result = nil
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: side.symbol)
                            Text(side.title)
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(pick == side ? Color.white : Color.primary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(
                            pick == side
                                ? AnyShapeStyle(side.tint.gradient)
                                : AnyShapeStyle(.ultraThinMaterial),
                            in: Capsule()
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(isFlipping)
                }
            }

            Button {
                flip()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                    Text(isFlipping ? "Flipping…" : "Flip")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(FunButtonStyle(color: .brown))
            .disabled(isFlipping || lives <= 0)

            HStack(spacing: 8) {
                Image(systemName: result == nil ? "questionmark.circle" : (result == pick ? "checkmark.circle.fill" : "xmark.circle.fill"))
                    .foregroundStyle(result == nil ? Color.secondary : (result == pick ? Color.green : Color.red))
                Text(message)
                    .font(.subheadline.weight(.medium))
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 44)
            .padding(.horizontal, 10)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

            if !history.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(Array(history.enumerated()), id: \.offset) { _, side in
                            Image(systemName: side.symbol)
                                .font(.caption.weight(.bold))
                                .foregroundStyle(side.tint)
                                .frame(width: 30, height: 30)
                                .background(side.tint.opacity(0.12), in: Circle())
                        }
                    }
                }
            }

            Text("Three correct flips in a row doubles the pressure. One wrong flip costs a life.")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .onAppear {
            lives = maxLives
        }
        .onChange(of: difficulty) { _, _ in reset() }
        .resultOverlay(lives <= 0) {
            ResultCard(
                symbol: "circle.hexagongrid.fill",
                title: "Out of lives",
                subtitle: "Score \(score) · best streak \(bestStreak)",
                tint: .brown,
                primaryTitle: "Flip again",
                primaryAction: reset
            )
        }
    }

    private func flip() {
        guard !isFlipping, lives > 0 else { return }

        isFlipping = true
        result = nil
        message = "In the air…"

        let outcome = Bool.random() ? pick : pick.opposite

        withAnimation(.easeInOut(duration: 0.9)) {
            spin += 720
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
            withAnimation(.snappy) {
                result = outcome
            }

            history.insert(outcome, at: 0)
            if history.count > 14 {
                history.removeLast()
            }

            if outcome == pick {
                streak += 1
                bestStreak = max(bestStreak, streak)
                let points = 10 * streak
                score += points
                message = "\(outcome.title). +\(points) · streak \(streak)."
            } else {
                streak = 0
                lives -= 1
                message = lives > 0
                    ? "\(outcome.title). \(lives) \(lives == 1 ? "life" : "lives") left."
                    : "\(outcome.title). No lives left."
            }

            isFlipping = false
        }
    }

    private func reset() {
        lives = maxLives
        streak = 0
        score = 0
        history = []
        result = nil
        spin = 0
        isFlipping = false
        message = "Pick a side and flip."
    }
}
