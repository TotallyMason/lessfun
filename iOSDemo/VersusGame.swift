import SwiftUI

// MARK: - Rock Paper Scissors

private enum RPSMove: String, CaseIterable, Identifiable {
    case rock
    case paper
    case scissors

    var id: String { rawValue }

    var title: String {
        switch self {
        case .rock: return "Rock"
        case .paper: return "Paper"
        case .scissors: return "Scissors"
        }
    }

    var symbol: String {
        switch self {
        case .rock: return "hand.raised.fill"
        case .paper: return "doc.plaintext.fill"
        case .scissors: return "scissors"
        }
    }

    var tint: Color {
        switch self {
        case .rock: return .orange
        case .paper: return .blue
        case .scissors: return .teal
        }
    }

    var beats: RPSMove {
        switch self {
        case .rock: return .scissors
        case .paper: return .rock
        case .scissors: return .paper
        }
    }

    static func counter(to move: RPSMove) -> RPSMove {
        switch move {
        case .rock: return .paper
        case .paper: return .scissors
        case .scissors: return .rock
        }
    }
}

private enum RPSOutcome {
    case win
    case lose
    case draw

    var title: String {
        switch self {
        case .win: return "You take the round"
        case .lose: return "Robot takes the round"
        case .draw: return "Stalemate"
        }
    }

    var symbol: String {
        switch self {
        case .win: return "checkmark.circle.fill"
        case .lose: return "xmark.circle.fill"
        case .draw: return "equal.circle.fill"
        }
    }

    var tint: Color {
        switch self {
        case .win: return .green
        case .lose: return .red
        case .draw: return .secondary
        }
    }
}

private struct RPSEntry: Identifiable {
    let id = UUID()
    let player: RPSMove
    let ai: RPSMove
    let outcome: RPSOutcome
}

struct RockPaperScissorsView: View {
    @AppStorage("lessfun.rps.seriesWins") private var seriesWins = 0
    @State private var difficulty: Difficulty = .normal
    @State private var playerMove: RPSMove?
    @State private var aiMove: RPSMove?
    @State private var playerScore = 0
    @State private var aiScore = 0
    @State private var lastPlayerMove: RPSMove?
    @State private var history: [RPSEntry] = []
    @State private var matchOver = false
    @State private var lastOutcome: RPSOutcome?
    @State private var message = "Pick your weapon."

    private let targetWins = 3

    var body: some View {
        GameShell(game: .rps) {
            DifficultyPicker(selection: $difficulty)

            HStack(spacing: 10) {
                ScoreTile(label: "You", value: "\(playerScore)", tint: .teal)
                ScoreTile(label: "Robot", value: "\(aiScore)", tint: .pink)
                ScoreTile(label: "Series", value: "\(seriesWins)", tint: .purple)
            }

            HStack(spacing: 18) {
                arena(move: playerMove, label: "You", tint: .teal)
                Text("VS")
                    .font(.caption.weight(.black))
                    .foregroundStyle(.secondary)
                arena(move: aiMove, label: "Robot", tint: .pink)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)

            HStack(spacing: 8) {
                Image(systemName: lastOutcome?.symbol ?? "questionmark.circle")
                    .foregroundStyle(lastOutcome?.tint ?? Color.secondary)
                Text(message)
                    .font(.subheadline.weight(.medium))
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 44)
            .padding(.horizontal, 10)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

            HStack(spacing: 8) {
                ForEach(RPSMove.allCases) { move in
                    Button {
                        choose(move)
                    } label: {
                        VStack(spacing: 6) {
                            Image(systemName: move.symbol)
                                .font(.title3.weight(.semibold))
                            Text(move.title)
                                .font(.caption2.weight(.semibold))
                        }
                        .foregroundStyle(playerMove == move ? Color.white : move.tint)
                        .frame(maxWidth: .infinity)
                        .frame(height: 72)
                        .background(
                            playerMove == move
                                ? AnyShapeStyle(move.tint.gradient)
                                : AnyShapeStyle(Color.primary.opacity(0.055)),
                            in: RoundedRectangle(cornerRadius: 16, style: .continuous)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(move.tint.opacity(playerMove == move ? 0.7 : 0.16))
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(matchOver)
                }
            }

            HStack {
                Text("First to \(targetWins) wins the series")
                Spacer()
                Text(difficulty == .brutal ? "Reads your habits" : "Mostly random")
            }
            .font(.caption2)
            .foregroundStyle(.secondary)

            if !history.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(history) { entry in
                            HStack(spacing: 4) {
                                Image(systemName: entry.player.symbol)
                                    .foregroundStyle(entry.player.tint)
                                Image(systemName: entry.outcome.symbol)
                                    .font(.system(size: 8))
                                    .foregroundStyle(entry.outcome.tint)
                                Image(systemName: entry.ai.symbol)
                                    .foregroundStyle(entry.ai.tint)
                            }
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .background(.ultraThinMaterial, in: Capsule())
                        }
                    }
                }
            }
        }
        .onChange(of: difficulty) { _, _ in reset() }
        .resultOverlay(matchOver) {
            ResultCard(
                symbol: playerScore > aiScore ? "trophy.fill" : "cpu.fill",
                title: playerScore > aiScore ? "Series won" : "Series lost",
                subtitle: "\(playerScore)–\(aiScore) · \(seriesWins) series wins overall",
                tint: playerScore > aiScore ? .teal : .pink,
                primaryTitle: "New match",
                primaryAction: reset
            )
        }
    }

    private func arena(move: RPSMove?, label: String, tint: Color) -> some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [tint.opacity(0.28), tint.opacity(0.08)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .overlay(Circle().strokeBorder(tint.opacity(0.3)))

                if let move {
                    Image(systemName: move.symbol)
                        .font(.system(size: 40, weight: .semibold))
                        .foregroundStyle(move.tint)
                        .transition(.scale.combined(with: .opacity))
                } else {
                    Image(systemName: "questionmark")
                        .font(.title.weight(.bold))
                        .foregroundStyle(.secondary.opacity(0.5))
                }
            }
            .frame(width: 118, height: 118)
            .animation(.spring(duration: 0.3), value: playerMove)
            .animation(.spring(duration: 0.3), value: aiMove)

            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }

    private func choose(_ move: RPSMove) {
        guard !matchOver else { return }

        let ai = pickAI()
        let outcome: RPSOutcome

        if move == ai {
            outcome = .draw
        } else if move.beats == ai {
            outcome = .win
            playerScore += 1
        } else {
            outcome = .lose
            aiScore += 1
        }

        lastPlayerMove = move
        lastOutcome = outcome
        history.insert(RPSEntry(player: move, ai: ai, outcome: outcome), at: 0)
        if history.count > 12 {
            history.removeLast()
        }

        withAnimation(.spring(duration: 0.3)) {
            playerMove = move
            aiMove = ai
        }

        switch outcome {
        case .win:
            message = "\(move.title) beats \(ai.title)."
        case .lose:
            message = "\(ai.title) beats \(move.title)."
        case .draw:
            message = "Both picked \(move.title)."
        }

        if playerScore >= targetWins || aiScore >= targetWins {
            if playerScore > aiScore {
                seriesWins += 1
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                withAnimation(.snappy) {
                    matchOver = true
                }
            }
        }
    }

    private func pickAI() -> RPSMove {
        let random = RPSMove.allCases.randomElement() ?? .rock
        guard let last = lastPlayerMove else { return random }

        let chance: Double
        switch difficulty {
        case .chill: chance = 0
        case .normal: chance = 0.35
        case .brutal: chance = 0.6
        }

        return Double.random(in: 0...1) < chance ? RPSMove.counter(to: last) : random
    }

    private func reset() {
        withAnimation(.snappy) {
            playerMove = nil
            aiMove = nil
            playerScore = 0
            aiScore = 0
            lastPlayerMove = nil
            history = []
            matchOver = false
            lastOutcome = nil
            message = "Pick your weapon."
        }
    }
}
