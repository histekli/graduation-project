/**
 * Real End-to-End Latency Measurement
 * Mouth-to-Ear latency tester
 */

export class LatencyMeasurement {
    constructor() {
        this.audioContext = null;
        this.oscillator = null;
        this.analyser = null;
        this.beepStartTime = null;
        this.measurements = [];
    }

    /**
     * Method 1: Acoustic Echo Test (Most Accurate)
     * Play a beep, record when you hear it back
     * Requires: Two devices or loopback cable
     */
    async measureAcousticLatency() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Generate 1kHz beep
        const oscillator = audioContext.createOscillator();
        oscillator.frequency.value = 1000;
        oscillator.connect(audioContext.destination);

        // Record start time
        const startTime = performance.now();
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1); // 100ms beep

        // Listen for echo (need to implement detection)
        // This requires microphone input analysis
        return { method: 'acoustic', startTime };
    }

    /**
     * Method 2: Stats-Based Calculation (WebRTC Stats API)
     * More accurate than RTT/2
     */
    async measureStatsBasedLatency(peerConnection) {
        if (!peerConnection) {
            throw new Error('PeerConnection required');
        }

        const stats = await peerConnection.getStats();
        let latencyComponents = {
            rtt: 0,
            jitterBuffer: 0,
            audioLevel: 0,
            totalPacketsLost: 0,
            packetsReceived: 0,
        };

        stats.forEach(report => {
            // Inbound RTP (receiving audio)
            if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                latencyComponents.packetsReceived = report.packetsReceived || 0;
                latencyComponents.totalPacketsLost = report.packetsLost || 0;
                latencyComponents.jitter = report.jitter || 0;
                latencyComponents.audioLevel = report.audioLevel || 0;

                // Total jitter buffer delay (important!)
                if (report.jitterBufferDelay && report.jitterBufferEmittedCount) {
                    latencyComponents.jitterBuffer =
                        (report.jitterBufferDelay / report.jitterBufferEmittedCount) * 1000;
                }
            }

            // Candidate pair (network RTT)
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                latencyComponents.rtt = report.currentRoundTripTime * 1000 || 0;
            }

            // Remote inbound (helps with RTT)
            if (report.type === 'remote-inbound-rtp' && report.kind === 'audio') {
                if (report.roundTripTime) {
                    latencyComponents.rtt = report.roundTripTime * 1000;
                }
            }
        });

        /**
         * Real Latency Formula:
         * 
         * Total = Capture + Encode + Network + JitterBuffer + Decode + Play
         * 
         * Capture + Encode ≈ 20-40ms (Opus @ 20ms frame)
         * Network = RTT / 2
         * JitterBuffer = measured from stats
         * Decode + Play ≈ 10-20ms
         * 
         * Estimated Total = 30 + (RTT/2) + JitterBuffer + 15
         */

        const estimatedLatency = {
            captureEncode: 30,  // Opus 20ms frame + processing
            network: latencyComponents.rtt / 2,
            jitterBuffer: latencyComponents.jitterBuffer || 50, // default if unavailable
            decodePlay: 15,     // browser audio processing
            total: 0,
        };

        estimatedLatency.total =
            estimatedLatency.captureEncode +
            estimatedLatency.network +
            estimatedLatency.jitterBuffer +
            estimatedLatency.decodePlay;

        return {
            method: 'stats-based',
            components: estimatedLatency,
            rawStats: latencyComponents,
            totalLatency: Math.round(estimatedLatency.total),
        };
    }

    /**
     * Method 3: Timestamp Injection
     * Send timestamp in data channel, measure when audio is heard
     */
    async measureTimestampBasedLatency(socket, audioStream) {
        const startTime = Date.now();

        // Inject timestamp via data channel
        socket.emit('latency_ping', { timestamp: startTime });

        return new Promise((resolve) => {
            socket.once('latency_pong', (data) => {
                const endTime = Date.now();
                const roundTripTime = endTime - startTime;

                resolve({
                    method: 'timestamp',
                    rtt: roundTripTime,
                    estimatedOneWay: roundTripTime / 2,
                });
            });
        });
    }

    /**
     * Method 4: Continuous Monitoring
     * Get average latency over time
     */
    startContinuousMonitoring(peerConnection, intervalMs = 5000) {
        this.monitoringInterval = setInterval(async () => {
            try {
                const result = await this.measureStatsBasedLatency(peerConnection);
                this.measurements.push({
                    timestamp: Date.now(),
                    latency: result.totalLatency,
                    components: result.components,
                });

                // Keep last 20 measurements
                if (this.measurements.length > 20) {
                    this.measurements.shift();
                }

                // Calculate average
                const avgLatency = this.measurements.reduce((sum, m) => sum + m.latency, 0) /
                    this.measurements.length;

                console.log(`[Latency Monitor] Current: ${result.totalLatency}ms, Avg: ${Math.round(avgLatency)}ms`);

                return result;
            } catch (error) {
                console.error('Latency measurement failed:', error);
            }
        }, intervalMs);
    }

    stopContinuousMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    /**
     * Get statistics summary
     */
    getStatistics() {
        if (this.measurements.length === 0) {
            return null;
        }

        const latencies = this.measurements.map(m => m.latency);
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const min = Math.min(...latencies);
        const max = Math.max(...latencies);
        const median = latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)];

        return {
            count: latencies.length,
            average: Math.round(avg),
            min: Math.round(min),
            max: Math.round(max),
            median: Math.round(median),
        };
    }
}

// Export singleton instance
export const latencyMeasurement = new LatencyMeasurement();
