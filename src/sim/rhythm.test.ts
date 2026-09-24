import { describe, expect, it } from 'vitest';
import { BASE_WINDOWS, BeatTrack, type NoteShape, type TrackEvent, gradeOffset, windowsFor } from './rhythm';

const SHAPE: NoteShape = { press: 0, release: 0.4 };
const notesOf = (events: TrackEvent[]) => events.flatMap((e) => (e.type === 'note' ? [e.note] : []));

/** A track at 100 BPM (600 ms per beat) with a set started at t=0. */
function startedTrack(shape = SHAPE) {
  const track = new BeatTrack(100, shape);
  expect(track.press(0)).toEqual([{ type: 'setStart' }]);
  track.release(10);
  return track;
}

describe('gradeOffset / windowsFor', () => {
  it('grades by distance from the target', () => {
    expect(gradeOffset(-30, BASE_WINDOWS)).toBe('perfect');
    expect(gradeOffset(80, BASE_WINDOWS)).toBe('good');
    expect(gradeOffset(-150, BASE_WINDOWS)).toBe('miss');
  });

  it('tightens windows when tired or in a heavier division', () => {
    expect(windowsFor(1, 1)).toEqual(BASE_WINDOWS);
    expect(windowsFor(0.7, 1).good).toBeLessThan(BASE_WINDOWS.good);
    expect(windowsFor(1, 1.15).perfect).toBeLessThan(BASE_WINDOWS.perfect);
  });
});

describe('BeatTrack', () => {
  it('starts a set with a count-in, then schedules notes on the beat', () => {
    const track = startedTrack();
    expect(track.state).toBe('countIn');
    expect(track.countIn).toEqual([600, 1200, 1800]);
    track.update(1850);
    expect(track.state).toBe('active');
    expect(track.notes[0]).toMatchObject({ beat: 2400, start: 2400, end: 2640 });
  });

  it('records a clean stroke: press on the start, release on the end', () => {
    const track = startedTrack();
    track.update(2300);
    track.press(2410);
    const [note] = notesOf(track.release(2630));
    expect(note).toMatchObject({ pressGrade: 'perfect', releaseOffset: -10, done: true });
  });

  it('ignores presses outside every window as stray', () => {
    const track = startedTrack();
    track.update(2000);
    expect(track.press(2100)).toEqual([{ type: 'stray' }]);
    expect(track.notes[0].pressedAt).toBeUndefined();
  });

  it('misses unplayed notes and ends the set after two in a row', () => {
    const track = startedTrack();
    const events = [...track.update(2300), ...track.update(2600), ...track.update(3200)];
    expect(notesOf(events)).toHaveLength(2);
    expect(events.at(-1)).toEqual({ type: 'setEnd' });
    expect(track.state).toBe('resting');
    expect(track.notes).toHaveLength(0);
  });

  it('finishes a note held past its release window with no release offset', () => {
    const track = startedTrack();
    track.update(2300);
    track.press(2400);
    const [note] = notesOf(track.update(2800));
    expect(note.releaseOffset).toBeUndefined();
    expect(track.heldNote).toBeUndefined();
  });

  it('lets an early press catch a note when the shape allows it', () => {
    const track = startedTrack({ press: -0.45, release: 0, earlyPress: 0.3 });
    track.update(1850);
    const note = track.notes[0];
    track.press(note.start - 150);
    expect(note.pressGrade).toBe('good');
    expect(track.heldNote).toBe(note);
  });

  it('applies a tempo change to notes scheduled after it', () => {
    const track = startedTrack();
    track.update(1000);
    const first = track.notes.map((n) => n.beat);
    track.bpm = 120;
    track.update(2500);
    const beats = track.notes.map((n) => n.beat);
    expect(first).toEqual([2400]);
    expect(beats[1] - beats[0]).toBe(600);
    expect(beats[2] - beats[1]).toBe(500);
  });
});
