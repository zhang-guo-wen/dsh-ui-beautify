import test from 'node:test'
import assert from 'node:assert/strict'
import { laneSpeed, observeOutput, tokensPerSecond } from '../src/client/output-rate.ts'

test('beam speed is zero at rest, monotonic, and perceptible per doubling', () => {
  assert.equal(laneSpeed(0), 0)
  let previous = 0
  for (const rate of [50, 100, 200, 400, 500, 1000]) {
    const speed = laneSpeed(rate)
    assert.ok(speed > previous, `${rate}: ${speed} <= ${previous}`)
    previous = speed
  }
  // Each doubling inside the ordinary band must be visible, not a rounding error.
  for (const rate of [60, 120, 240, 480]) {
    assert.ok(laneSpeed(rate * 2) - laneSpeed(rate) > 0.35, String(rate))
  }
})

test('the ordinary 50–500 token band is spread out, not flattened', () => {
  const slow = laneSpeed(200)
  const fast = laneSpeed(500)
  assert.ok(fast > slow * 1.4, `${slow.toFixed(2)} vs ${fast.toFixed(2)} spans/s`)
  // A 50-token/s stream still moves, but at a calm pace.
  assert.ok(laneSpeed(50) > 0.4 && laneSpeed(50) < 0.8, String(laneSpeed(50)))
  // Above the usual band the speed keeps growing without hitting a wall.
  assert.ok(laneSpeed(1000) > fast && laneSpeed(1000) < 3.2, String(laneSpeed(1000)))
})

test('rate stays stable between chunks, stops on silence, and resets for new step', () => {
  let samples = observeOutput([], 0, 0)
  samples = observeOutput(samples, 60, 500)
  assert.equal(tokensPerSecond(samples, 510), 120)
  assert.equal(tokensPerSecond(samples, 800), 120)
  assert.equal(tokensPerSecond(samples, 1401), 0)
  assert.equal(tokensPerSecond(observeOutput(samples, 0, 900), 900), 0)
})