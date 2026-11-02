import Combine
import SwiftUI

// MARK: - Tap Frenzy

struct TapFrenzyView: View {
    @AppStorage("lessfun.best.tapFrenzy") private var best = 0
    @State private var difficulty: Difficulty = .normal
    @State private var score = 0
    @State private var timeLeft = 10.0
    @State private var isRunning = false
    @State private var isOver = false
    @State private var combo = 0
    @State private var lastTap = Date.distantPast
    @State private var ripples: [UUID] = []
    @State private var padScale: CGFloat = 1

    private let ticker = Timer.publish(every: 0.05, on: .main, in: .common).autoconnect()

    private var duration: Double {
        switch difficulty {
        case .chill: return 15
        case .normal: return 10
        case .brutal: return 6
        }
    }

    private var multiplier: Int {
        combo / 5 + 1
    }

    var body: some View {
        GameShell(game: .tapFrenzy) {
            DifficultyPicker(selection: $difficulty)
                .disabled(isRunning)

            HStack(spacing: 10) {
                ScoreTile(label: "Score", value: "\(score)", tint: .orange)
                ScoreTile(label: "Combo", value: combo > 1 ? "x\(combo)" : "—", tint: .pink)
                ScoreTile(label: "Best", value: "\(best)", tint: .purple)
            }

            ArcadeProgressBar(progress: timeLeft / duration, tint: .orange)

            ZStack {
                ForEach(ripples, id: \.self) { _ in
                    TapRipple(tint: .orange)
                        .frame(width: 240, height: 240)
                        .allowsHitTesting(false)
                }

                Button(action: tap) {
                    ZStack {
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [.yellow, .orange, .pink],
                                    center: .center,
                                    startRadius: 8,
                                    endRadius: 150
                                )
                            )
                            .frame(width: 240, height: 240)
                            .shadow(color: .orange.opacity(isRunning ? 0.6 : 0.25), radius: isRunning ? 36 : 18)

                        Circle()
                            .strokeBorder(.white.opacity(0.25), lineWidth: 2)
                            .frame(width: 218, height: 218)

                        VStack(spacing: 8) {
                            Image(systemName: isRunning ? "hand.tap.fill" : "play.fill")
                                .font(.system(size: 46, weight: .bold))
                                .symbolEffect(.pulse, options: .repeating)

                            Text(isRunning ? "TAP" : (score > 0 ? "Again" : "Start"))
                                .font(.system(size: 30, weight: .black, design: .rounded))
                        }
                        .foregroundStyle(.white)
                    }
                    .scaleEffect(padScale)
                }
                .buttonStyle(.plain)
                .disabled(isOver)
            }
            .frame(height: 280)

            HStack(spacing: 8) {
                Image(systemName: combo > 1 ? "flame.fill" : "hand.tap")
                    .foregroundStyle(combo > 1 ? Color.orange : Color.secondary)

                Text(combo > 1 ? "\(combo) tap combo · \(multiplier)x points" : "Tap fast to build a combo")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .animation(.snappy, value: combo)
        }
        .onReceive(ticker) { _ in tick() }
        .onChange(of: difficulty) { _, _ in reset() }
        .resultOverlay(isOver) {
            ResultCard(
                symbol: "bolt.fill",
                title: "Time's up",
                subtitle: "\(score) points · best combo x\(combo)",
                tint: .orange,
                primaryTitle: "Play again",
                primaryAction: {
                    reset()
                    isOver = false
                }
            )
        }
    }

    private func tap() {
        if !isRunning {
            score = 0
            combo = 0
            timeLeft = duration
            isRunning = true
            isOver = false
            lastTap = .distantPast
            return
        }

        let now = Date()
        if now.timeIntervalSince(lastTap) < 0.45 {
            combo += 1
        } else {
            combo = 1
        }
        lastTap = now

        withAnimation(.snappy(duration: 0.15)) {
            score += multiplier
            padScale = 0.93
        }

        let id = UUID()
        ripples.append(id)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
            withAnimation(.snappy(duration: 0.2)) {
                padScale = 1
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.65) {
            ripples.removeAll { $0 == id }
        }
    }

    private func tick() {
        guard isRunning else { return }

        timeLeft = max(0, timeLeft - 0.05)

        if timeLeft <= 0.001 {
            timeLeft = 0
            isRunning = false
            isOver = true
            best = max(best, score)
        }
    }

    private func reset() {
        score = 0
        combo = 0
        timeLeft = duration
        isRunning = false
        isOver = false
    }
}

private struct TapRipple: View {
    let tint: Color
    @State private var animate = false

    var body: some View {
        Circle()
            .stroke(tint.opacity(0.7), lineWidth: 6)
            .scaleEffect(animate ? 2.1 : 0.4)
            .opacity(animate ? 0 : 0.9)
            .onAppear {
                withAnimation(.easeOut(duration: 0.55)) {
                    animate = true
                }
            }
    }
}

// MARK: - Whack-a-Mole

private enum MoleKind: Equatable {
    case mole
    case gold
    case bomb

    var symbol: String {
        switch self {
        case .mole: return "pawprint.fill"
        case .gold: return "star.circle.fill"
        case .bomb: return "exclamationmark.triangle.fill"
        }
    }

    var tint: Color {
        switch self {
        case .mole: return .green
        case .gold: return .yellow
        case .bomb: return .red
        }
    }
}

struct WhackAMoleView: View {
    @AppStorage("lessfun.best.whack") private var best = 0
    @State private var difficulty: Difficulty = .normal
    @State private var score = 0
    @State private var timeLeft = 18.0
    @State private var combo = 0
    @State private var moleIndex: Int?
    @State private var kind: MoleKind?
    @State private var spawnCountdown = 0.0
    @State private var isRunning = false
    @State private var isOver = false

    private let ticker = Timer.publish(every: 0.05, on: .main, in: .common).autoconnect()
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 3)

    private var duration: Double {
        switch difficulty {
        case .chill: return 22
        case .normal: return 18
        case .brutal: return 14
        }
    }

    private var spawnInterval: Double {
        switch difficulty {
        case .chill: return 0.95
        case .normal: return 0.72
        case .brutal: return 0.5
        }
    }

    private var bombChance: Double {
        switch difficulty {
        case .chill: return 0.06
        case .normal: return 0.16
        case .brutal: return 0.26
        }
    }

    var body: some View {
        GameShell(game: .whack) {
            DifficultyPicker(selection: $difficulty)
                .disabled(isRunning)

            HStack(spacing: 10) {
                ScoreTile(label: "Score", value: "\(score)", tint: .green)
                ScoreTile(label: "Combo", value: combo > 0 ? "x\(combo)" : "—", tint: .orange)
                ScoreTile(label: "Time", value: String(format: "%.1f", max(0, timeLeft)), tint: .red)
                ScoreTile(label: "Best", value: "\(best)", tint: .purple)
            }

            ArcadeProgressBar(progress: timeLeft / duration, tint: .green)

            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(0..<9, id: \.self) { index in
                    Button {
                        whack(index)
                    } label: {
                        cell(index)
                    }
                    .buttonStyle(.plain)
                }
            }

            Button(isRunning ? "Whacking…" : (isOver ? "Play again" : "Start")) {
                start()
            }
            .disabled(isRunning)
            .buttonStyle(FunButtonStyle(color: .green))

            HStack(spacing: 14) {
                legend("pawprint.fill", "1 pt", .green)
                legend("star.circle.fill", "3x", .yellow)
                legend("exclamationmark.triangle.fill", "-2s", .red)
            }
            .font(.caption2)
            .foregroundStyle(.secondary)

            Text("Chain hits for bonus points. Bombs cost time.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .onReceive(ticker) { _ in tick() }
        .onChange(of: difficulty) { _, _ in reset() }
        .resultOverlay(isOver) {
            ResultCard(
                symbol: "hammer.fill",
                title: "Time's up",
                subtitle: "\(score) points · best \(best)",
                tint: .green,
                primaryTitle: "Play again",
                primaryAction: {
                    reset()
                    start()
                }
            )
        }
    }

    private func cell(_ index: Int) -> some View {
        let activeKind = moleIndex == index ? kind : nil

        return ZStack {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(activeKind?.tint.opacity(0.2) ?? Color.primary.opacity(0.055))

            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(
                    activeKind?.tint.opacity(0.55) ?? Color.white.opacity(0.06),
                    lineWidth: 1
                )

            if let activeKind {
                Image(systemName: activeKind.symbol)
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(activeKind.tint)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .frame(height: 76)
    }

    private func legend(_ symbol: String, _ text: String, _ tint: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: symbol)
                .foregroundStyle(tint)
            Text(text)
        }
    }

    private func start() {
        score = 0
        combo = 0
        timeLeft = duration
        spawnCountdown = 0
        isRunning = true
        isOver = false
        withAnimation(.spring(duration: 0.3)) {
            moleIndex = nil
            kind = nil
        }
    }

    private func whack(_ index: Int) {
        guard isRunning, moleIndex == index, let kind else { return }

        switch kind {
        case .mole:
            combo += 1
            score += 1 + combo / 4
        case .gold:
            combo += 1
            score += (1 + combo / 4) * 3
        case .bomb:
            combo = 0
            score = max(0, score - 3)
            timeLeft = max(0, timeLeft - 2)
        }

        withAnimation(.snappy(duration: 0.2)) {
            moleIndex = nil
            self.kind = nil
        }

        spawnCountdown = 0.16
    }

    private func tick() {
        guard isRunning else { return }

        timeLeft = max(0, timeLeft - 0.05)
        spawnCountdown -= 0.05

        if spawnCountdown <= 0 {
            spawn()
            spawnCountdown = spawnInterval
        }

        if timeLeft <= 0.001 {
            timeLeft = 0
            isRunning = false
            isOver = true
            best = max(best, score)
            withAnimation(.snappy) {
                moleIndex = nil
                kind = nil
            }
        }
    }

    private func spawn() {
        let candidates = (0..<9).filter { $0 != moleIndex }
        guard let index = candidates.randomElement() else { return }

        let roll = Double.random(in: 0...1)
        let next: MoleKind

        if roll < bombChance {
            next = .bomb
        } else if roll < bombChance + 0.12 {
            next = .gold
        } else {
            next = .mole
        }

        withAnimation(.spring(duration: 0.22)) {
            moleIndex = index
            kind = next
        }
    }

    private func reset() {
        score = 0
        combo = 0
        timeLeft = duration
        isRunning = false
        isOver = false
        moleIndex = nil
        kind = nil
    }
}

// MARK: - Reaction Test

private enum ReactionPhase: Equatable {
    case idle
    case waiting
    case ready
    case tooSoon
    case done
    case finished
}

struct ReactionTestView: View {
    @AppStorage("lessfun.best.reaction") private var best = 0
    @State private var difficulty: Difficulty = .normal
    @State private var phase: ReactionPhase = .idle
    @State private var attempts: [Int] = []
    @State private var readyAt = Date()
    @State private var token = UUID()

    private let totalRounds = 5

    private var average: Int {
        guard !attempts.isEmpty else { return 0 }
        return attempts.reduce(0, +) / attempts.count
    }

    private var fastest: Int {
        attempts.min() ?? 0
    }

    var body: some View {
        GameShell(game: .reaction) {
            DifficultyPicker(selection: $difficulty)
                .disabled(phase == .waiting || phase == .ready)

            HStack(spacing: 10) {
                ScoreTile(label: "Last", value: attempts.last.map { "\($0) ms" } ?? "—", tint: .yellow)
                ScoreTile(label: "Fastest", value: fastest > 0 ? "\(fastest) ms" : "—", tint: .green)
                ScoreTile(label: "Average", value: average > 0 ? "\(average) ms" : "—", tint: .orange)
                ScoreTile(label: "Round", value: "\(min(attempts.count + 1, totalRounds))/\(totalRounds)", tint: .blue)
            }

            Button(action: handleTap) {
                ZStack {
                    RoundedRectangle(cornerRadius: 26, style: .continuous)
                        .fill(backgroundGradient)

                    if phase == .waiting {
                        PulseRings(tint: .white)
                            .frame(width: 220, height: 220)
                    }

                    VStack(spacing: 12) {
                        Image(systemName: icon)
                            .font(.system(size: 52, weight: .bold))
                            .symbolEffect(.bounce, value: phase == .ready)

                        Text(prompt)
                            .font(.headline)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                    }
                    .foregroundStyle(.white)
                }
                .frame(height: 300)
                .animation(.snappy(duration: 0.25), value: phase)
            }
            .buttonStyle(.plain)

            if !attempts.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Rounds")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)

                    GeometryReader { proxy in
                        HStack(alignment: .bottom, spacing: 6) {
                            ForEach(Array(attempts.enumerated()), id: \.offset) { _, ms in
                                let ratio = fastest > 0 ? Double(fastest) / Double(max(ms, 1)) : 1
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(
                                        LinearGradient(
                                            colors: [.yellow.opacity(0.7), .orange],
                                            startPoint: .bottom,
                                            endPoint: .top
                                        )
                                    )
                                    .frame(height: max(10, proxy.size.height * ratio))
                            }
                        }
                    }
                    .frame(height: 56)
                }
                .padding(12)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }

            Text("Tap when the screen turns green. False starts don't count.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .resultOverlay(phase == .finished) {
            ResultCard(
                symbol: "flag.checkered",
                title: "Five rounds done",
                subtitle: "Average \(average) ms · fastest \(fastest) ms · best \(best) ms",
                tint: .yellow,
                primaryTitle: "Run it back",
                primaryAction: reset
            )
        }
    }

    private var backgroundGradient: LinearGradient {
        let colors: [Color]

        switch phase {
        case .idle, .done, .finished:
            colors = [.blue.opacity(0.85), .indigo]
        case .waiting:
            colors = [.red.opacity(0.9), .orange.opacity(0.85)]
        case .ready:
            colors = [.green, .teal]
        case .tooSoon:
            colors = [.orange, .red.opacity(0.8)]
        }

        return LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    private var icon: String {
        switch phase {
        case .idle: return "bolt.fill"
        case .waiting: return "hourglass"
        case .ready: return "hand.tap.fill"
        case .tooSoon: return "exclamationmark.triangle.fill"
        case .done: return "checkmark.circle.fill"
        case .finished: return "flag.checkered"
        }
    }

    private var prompt: String {
        switch phase {
        case .idle: return "Tap to start"
        case .waiting: return "Wait for green…"
        case .ready: return "TAP NOW"
        case .tooSoon: return "Too soon. Tap to retry"
        case .done: return "\(attempts.last ?? 0) ms — tap for round \(attempts.count + 1)"
        case .finished: return "Done"
        }
    }

    private func handleTap() {
        switch phase {
        case .idle, .tooSoon, .done:
            begin()
        case .waiting:
            token = UUID()
            withAnimation(.snappy) {
                phase = .tooSoon
            }
        case .ready:
            let milliseconds = Int(Date().timeIntervalSince(readyAt) * 1000)
            attempts.append(milliseconds)
            best = best == 0 ? milliseconds : min(best, milliseconds)

            withAnimation(.snappy) {
                phase = attempts.count >= totalRounds ? .finished : .done
            }
        case .finished:
            break
        }
    }

    private func begin() {
        withAnimation(.snappy) {
            phase = .waiting
        }

        let current = UUID()
        token = current

        let delay: Double
        switch difficulty {
        case .chill: delay = Double.random(in: 1.6...3.6)
        case .normal: delay = Double.random(in: 1.1...3.0)
        case .brutal: delay = Double.random(in: 0.7...2.2)
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            guard token == current, phase == .waiting else { return }
            readyAt = Date()
            withAnimation(.snappy) {
                phase = .ready
            }
        }
    }

    private func reset() {
        attempts = []
        withAnimation(.snappy) {
            phase = .idle
        }
    }
}

private struct PulseRings: View {
    let tint: Color
    @State private var animate = false

    var body: some View {
        ZStack {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .stroke(tint.opacity(0.35), lineWidth: 2)
                    .scaleEffect(animate ? 1.3 : 0.55)
                    .opacity(animate ? 0 : 0.8)
                    .animation(
                        .easeOut(duration: 1.6)
                            .repeatForever(autoreverses: false)
                            .delay(Double(index) * 0.5),
                        value: animate
                    )
            }
        }
        .onAppear { animate = true }
        .allowsHitTesting(false)
    }
}
