import SwiftUI

struct GamesHomeView: View {
    @State private var path = NavigationPath()
    @State private var filter: GameCategory = .all
    @State private var appeared = false

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    private var filtered: [Game] {
        filter == .all ? Game.allCases : Game.allCases.filter { $0.category == filter }
    }

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    chips
                    grid
                    randomButton
                    footer
                }
                .padding()
            }
            .background(ArcadeBackground(color: .purple))
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: Game.self) { $0.destination }
            .onAppear {
                appeared = true

                let arguments = ProcessInfo.processInfo.arguments
                if let index = arguments.firstIndex(of: "-game"),
                   index + 1 < arguments.count,
                   let game = Game(rawValue: arguments[index + 1]) {
                    path.append(game)
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text("LessFun")
                    .font(.system(size: 44, weight: .black, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.purple, .pink, .orange],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )

                Image(systemName: "sparkles")
                    .font(.title3)
                    .foregroundStyle(.yellow)
                    .symbolEffect(.pulse, options: .repeating)
            }

            Text("Ten games. Zero guarantees.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            HStack(spacing: 8) {
                badge("\(Game.allCases.count) games", symbol: "square.grid.2x2.fill")
            }
            .padding(.top, 2)
        }
    }

    private var chips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(GameCategory.allCases) { category in
                    Button {
                        withAnimation(.snappy) { filter = category }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: category.symbol)
                            Text(category.title)
                        }
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 13)
                        .padding(.vertical, 8)
                        .foregroundStyle(filter == category ? Color.white : Color.primary)
                        .background(
                            filter == category ? Color.purple : Color.primary.opacity(0.07),
                            in: Capsule()
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var grid: some View {
        LazyVGrid(columns: columns, spacing: 12) {
            ForEach(filtered) { game in
                let index = filtered.firstIndex(of: game) ?? 0

                NavigationLink(value: game) {
                    GameCard(game: game)
                }
                .buttonStyle(PressableCardStyle())
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 18)
                .animation(.snappy.delay(Double(index) * 0.035), value: appeared)
            }
        }
        .animation(.snappy, value: filter)
    }

    private var randomButton: some View {
        Button {
            if let game = filtered.randomElement() {
                path.append(game)
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "shuffle")
                    .font(.headline)
                Text("Surprise me")
                    .font(.headline)
                Spacer()
                Image(systemName: "arrow.right.circle.fill")
                    .font(.title3)
            }
            .foregroundStyle(.white)
            .padding(16)
            .background(
                LinearGradient(
                    colors: [.purple.opacity(0.75), .blue.opacity(0.6)],
                    startPoint: .leading,
                    endPoint: .trailing
                ),
                in: RoundedRectangle(cornerRadius: 18, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(.white.opacity(0.18))
            )
        }
        .buttonStyle(PressableCardStyle())
    }

    private var footer: some View {
        Text("Built for fun. Mostly.")
            .font(.caption2)
            .foregroundStyle(.tertiary)
            .frame(maxWidth: .infinity)
            .padding(.top, 4)
    }

    private func badge(_ text: String, symbol: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: symbol)
            Text(text)
        }
        .font(.caption2.weight(.medium))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(.ultraThinMaterial, in: Capsule())
    }
}

struct GameCard: View {
    let game: Game

    @AppStorage private var best: Int

    init(game: Game) {
        self.game = game
        _best = AppStorage(wrappedValue: 0, game.bestKey)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [game.color.opacity(0.3), game.color.opacity(0.12)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    Image(systemName: game.symbol)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(game.color)
                }
                .frame(width: 42, height: 42)

                Spacer()

                if best > 0 {
                    VStack(spacing: 0) {
                        Text("BEST")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(.secondary)
                        Text("\(best)")
                            .font(.caption.bold())
                            .monospacedDigit()
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.white.opacity(0.07), in: Capsule())
                }
            }

            Text(game.title)
                .font(.headline)
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            Text(game.tagline)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .frame(height: 28, alignment: .topLeading)

            HStack {
                Text(game.category.title.uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(game.color)

                Spacer()

                Image(systemName: "arrow.up.right")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 158, alignment: .topLeading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [game.color.opacity(0.45), game.color.opacity(0.08)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
    }
}

#Preview {
    GamesHomeView()
}
