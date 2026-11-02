import SwiftUI

// MARK: - Catalog

enum GameCategory: String, CaseIterable, Identifiable {
    case all
    case arcade
    case puzzle
    case luck
    case versus

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: return "All"
        case .arcade: return "Arcade"
        case .puzzle: return "Puzzle"
        case .luck: return "Luck"
        case .versus: return "Versus"
        }
    }

    var symbol: String {
        switch self {
        case .all: return "square.grid.2x2.fill"
        case .arcade: return "bolt.fill"
        case .puzzle: return "puzzlepiece.fill"
        case .luck: return "dice.fill"
        case .versus: return "hand.raised.fill"
        }
    }
}

enum Difficulty: String, CaseIterable, Identifiable {
    case chill
    case normal
    case brutal

    var id: String { rawValue }

    var title: String {
        switch self {
        case .chill: return "Chill"
        case .normal: return "Normal"
        case .brutal: return "Brutal"
        }
    }

    var symbol: String {
        switch self {
        case .chill: return "leaf.fill"
        case .normal: return "flame.fill"
        case .brutal: return "bolt.fill"
        }
    }

    var tint: Color {
        switch self {
        case .chill: return .green
        case .normal: return .orange
        case .brutal: return .red
        }
    }

    var scoreMultiplier: Int {
        switch self {
        case .chill: return 1
        case .normal: return 2
        case .brutal: return 3
        }
    }
}

enum Game: String, CaseIterable, Identifiable, Hashable {
    case tapFrenzy
    case memory
    case ticTacToe
    case whack
    case reaction
    case higherLower
    case rps
    case guessNumber
    case dice
    case coinFlip

    var id: String { rawValue }

    var title: String {
        switch self {
        case .tapFrenzy: return "Tap Frenzy"
        case .memory: return "Memory Match"
        case .ticTacToe: return "Tic-Tac-Toe"
        case .whack: return "Whack-a-Mole"
        case .reaction: return "Reaction Test"
        case .higherLower: return "Higher / Lower"
        case .rps: return "Rock Paper Scissors"
        case .guessNumber: return "Guess the Number"
        case .dice: return "Dice Roller"
        case .coinFlip: return "Coin Flip"
        }
    }

    var symbol: String {
        switch self {
        case .tapFrenzy: return "hand.tap.fill"
        case .memory: return "brain.head.profile"
        case .ticTacToe: return "square.grid.3x3.fill"
        case .whack: return "hammer.fill"
        case .reaction: return "bolt.fill"
        case .higherLower: return "suit.spade.fill"
        case .rps: return "scissors"
        case .guessNumber: return "number.circle.fill"
        case .dice: return "dice.fill"
        case .coinFlip: return "circle.hexagongrid.fill"
        }
    }

    var tagline: String {
        switch self {
        case .tapFrenzy: return "Ten seconds. Maximum chaos."
        case .memory: return "Find the pairs. Beat the clock."
        case .ticTacToe: return "Three brains, one robot."
        case .whack: return "Moles, gold, and bombs."
        case .reaction: return "How slow are your thumbs?"
        case .higherLower: return "A deck, three lives, one guess."
        case .rps: return "First to three. Settle it."
        case .guessNumber: return "Narrow it down, fast."
        case .dice: return "Predict the roll. Risk the chips."
        case .coinFlip: return "Pick a side. Build a streak."
        }
    }

    var color: Color {
        switch self {
        case .tapFrenzy: return .orange
        case .memory: return .pink
        case .ticTacToe: return .indigo
        case .whack: return .green
        case .reaction: return .yellow
        case .higherLower: return .purple
        case .rps: return .teal
        case .guessNumber: return .blue
        case .dice: return .red
        case .coinFlip: return .brown
        }
    }

    var category: GameCategory {
        switch self {
        case .tapFrenzy, .whack, .reaction: return .arcade
        case .memory, .ticTacToe, .guessNumber: return .puzzle
        case .higherLower, .dice, .coinFlip: return .luck
        case .rps: return .versus
        }
    }

    var bestKey: String {
        switch self {
        case .tapFrenzy: return "lessfun.best.tapFrenzy"
        case .memory: return "lessfun.best.memory"
        case .ticTacToe: return "lessfun.ttt.wins"
        case .whack: return "lessfun.best.whack"
        case .reaction: return "lessfun.best.reaction"
        case .higherLower: return "lessfun.best.higherLower"
        case .rps: return "lessfun.rps.seriesWins"
        case .guessNumber: return "lessfun.best.guessNumber"
        case .dice: return "lessfun.best.dice"
        case .coinFlip: return "lessfun.best.coinFlip"
        }
    }

    @ViewBuilder
    var destination: some View {
        switch self {
        case .tapFrenzy: TapFrenzyView()
        case .memory: MemoryMatchView()
        case .ticTacToe: TicTacToeView()
        case .whack: WhackAMoleView()
        case .reaction: ReactionTestView()
        case .higherLower: HigherLowerView()
        case .rps: RockPaperScissorsView()
        case .guessNumber: GuessNumberView()
        case .dice: DiceRollerView()
        case .coinFlip: CoinFlipView()
        }
    }
}

// MARK: - Shared chrome

struct ArcadeBackground: View {
    let color: Color

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drift = false

    var body: some View {
        ZStack {
            Color(.systemBackground)

            LinearGradient(
                colors: [color.opacity(0.30), color.opacity(0.08), Color(.systemBackground)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Circle()
                .fill(color.opacity(0.30))
                .frame(width: 280, height: 280)
                .blur(radius: 70)
                .offset(x: drift ? 130 : -130, y: drift ? -260 : -160)

            Circle()
                .fill(Color.indigo.opacity(0.18))
                .frame(width: 240, height: 240)
                .blur(radius: 80)
                .offset(x: drift ? -150 : 140, y: drift ? 300 : 200)

            Circle()
                .fill(Color.cyan.opacity(0.12))
                .frame(width: 180, height: 180)
                .blur(radius: 60)
                .offset(x: drift ? 60 : -60, y: drift ? 120 : 300)
        }
        .ignoresSafeArea()
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 9).repeatForever(autoreverses: true)) {
                drift = true
            }
        }
    }
}

struct PressableCardStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .brightness(configuration.isPressed ? -0.03 : 0)
            .animation(.snappy(duration: 0.18), value: configuration.isPressed)
    }
}

struct GameShell<Content: View>: View {
    let game: Game
    private let content: Content

    init(game: Game, @ViewBuilder content: () -> Content) {
        self.game = game
        self.content = content()
    }

    var body: some View {
        ZStack {
            ArcadeBackground(color: game.color)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 16) {
                    GameTitleBlock(game: game)
                    content
                }
                .padding()
                .padding(.bottom, 28)
            }
        }
        .navigationTitle(game.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct GameTitleBlock: View {
    let game: Game

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(game.color.opacity(0.16))
                Image(systemName: game.symbol)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(game.color)
            }
            .frame(width: 50, height: 50)

            VStack(alignment: .leading, spacing: 2) {
                Text(game.title)
                    .font(.title3.weight(.bold))
                Text(game.tagline)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

struct DifficultyPicker: View {
    @Binding var selection: Difficulty

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Difficulty.allCases) { level in
                Button {
                    withAnimation(.snappy(duration: 0.25)) {
                        selection = level
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: level.symbol)
                            .font(.caption2.weight(.bold))
                        Text(level.title)
                            .font(.caption.weight(.semibold))
                    }
                    .foregroundStyle(selection == level ? Color.white : Color.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background {
                        if selection == level {
                            Capsule().fill(level.tint.gradient)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(.white.opacity(0.08)))
    }
}

struct ScoreTile: View {
    let label: String
    let value: String
    var tint: Color = .primary

    var body: some View {
        VStack(spacing: 3) {
            Text(label)
                .font(.caption2.weight(.medium))
                .foregroundStyle(.secondary)

            Text(value)
                .font(.headline.monospacedDigit())
                .foregroundStyle(tint)
                .contentTransition(.numericText())
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(tint.opacity(0.16))
        )
    }
}

struct ArcadeProgressBar: View {
    let progress: Double
    var tint: Color = .accentColor
    var height: CGFloat = 10

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.primary.opacity(0.08))

                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [tint.opacity(0.65), tint],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: max(0, min(1, progress)) * proxy.size.width)
            }
        }
        .frame(height: height)
        .animation(.linear(duration: 0.12), value: progress)
    }
}

struct FunButtonStyle: ButtonStyle {
    var color: Color
    var compact: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.white)
            .padding(.horizontal, compact ? 16 : 26)
            .padding(.vertical, compact ? 9 : 13)
            .background(
                LinearGradient(
                    colors: [color, color.opacity(0.72)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: Capsule()
            )
            .overlay(Capsule().strokeBorder(.white.opacity(0.18)))
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .animation(.snappy(duration: 0.18), value: configuration.isPressed)
    }
}

struct ResultCard: View {
    let symbol: String
    let title: String
    let subtitle: String
    let tint: Color
    let primaryTitle: String
    let primaryAction: () -> Void

    var secondaryTitle: String? = nil
    var secondaryAction: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(tint.opacity(0.18))
                    .frame(width: 84, height: 84)
                Image(systemName: symbol)
                    .font(.system(size: 36, weight: .bold))
                    .foregroundStyle(tint)
            }

            Text(title)
                .font(.title2.weight(.bold))
                .multilineTextAlignment(.center)

            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            HStack(spacing: 10) {
                Button(primaryTitle) { primaryAction() }
                    .buttonStyle(FunButtonStyle(color: tint))

                if let secondaryTitle, let secondaryAction {
                    Button(secondaryTitle) { secondaryAction() }
                        .buttonStyle(FunButtonStyle(color: .gray, compact: true))
                }
            }
            .padding(.top, 4)
        }
        .padding(24)
        .frame(maxWidth: 340)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(tint.opacity(0.25))
        )
        .shadow(color: .black.opacity(0.25), radius: 30, y: 14)
        .padding(24)
    }
}

extension View {
    func resultOverlay<Overlay: View>(
        _ isPresented: Bool,
        @ViewBuilder content: () -> Overlay
    ) -> some View {
        overlay {
            if isPresented {
                ZStack {
                    Color.black.opacity(0.35)
                        .ignoresSafeArea()
                    content()
                }
                .transition(.opacity.combined(with: .scale(scale: 0.96)))
            }
        }
        .animation(.spring(duration: 0.35), value: isPresented)
    }
}

func formatClock(_ seconds: Int) -> String {
    String(format: "%d:%02d", seconds / 60, seconds % 60)
}
