/**
 * Web MIDI input (plug-and-play in Chrome/Edge).
 *
 * Parses incoming MIDI and routes it into the app's existing paths: note
 * on/off, pitch bend, and the modulation wheel (CC 1). Channel is ignored
 * so any keyboard on any channel just works. No MIDI output, no SysEx.
 */

/**
 * Parse one raw MIDI message into a normalized action, or null if it is
 * not one we handle. Pure — unit-tested.
 * @param {Uint8Array|number[]} data
 */
export function parseMidiMessage(data) {
  const status = data[0] & 0xf0;
  const d1 = data[1] ?? 0;
  const d2 = data[2] ?? 0;
  switch (status) {
    case 0x90: // note on (velocity 0 means note off)
      return d2 > 0 ? { type: 'noteOn', note: d1, velocity: d2 } : { type: 'noteOff', note: d1 };
    case 0x80: // note off
      return { type: 'noteOff', note: d1 };
    case 0xe0: { // pitch bend: 14-bit, centre 8192 -> -1..1
      const value = ((d2 << 7) | d1) - 8192;
      return { type: 'pitchBend', value: Math.max(-1, Math.min(1, value / 8192)) };
    }
    case 0xb0: // control change
      return { type: 'cc', controller: d1, value: d2 };
    default:
      return null;
  }
}

/**
 * Route a raw MIDI message through the given handlers.
 * @param {Uint8Array|number[]} data
 * @param {{noteOn:Function,noteOff:Function,pitchBend:Function,modWheel:Function,allOff?:Function}} h
 */
export function routeMidiMessage(data, h) {
  const msg = parseMidiMessage(data);
  if (!msg) return;
  switch (msg.type) {
    case 'noteOn': h.noteOn(msg.note, msg.velocity); break;
    case 'noteOff': h.noteOff(msg.note); break;
    case 'pitchBend': h.pitchBend(msg.value); break;
    case 'cc':
      if (msg.controller === 1) h.modWheel(msg.value / 127); // mod wheel
      else if (msg.controller === 120 || msg.controller === 123) h.allOff?.(); // all sound/notes off
      break;
  }
}

/**
 * Request Web MIDI access and attach to every input (now and as devices
 * are hotplugged). Degrades silently if the browser has no Web MIDI or the
 * user declines.
 *
 * @param {{noteOn:Function,noteOff:Function,pitchBend:Function,modWheel:Function,allOff?:Function,onStatus?:(s:string,name?:string)=>void}} handlers
 * @returns {Promise<{enabled:boolean, route:(data:Uint8Array|number[])=>void}>}
 */
export async function installMidi(handlers) {
  const route = (data) => routeMidiMessage(data, handlers);

  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
    handlers.onStatus?.('unsupported');
    return { enabled: false, route };
  }

  let access;
  try {
    access = await navigator.requestMIDIAccess({ sysex: false });
  } catch {
    handlers.onStatus?.('denied');
    return { enabled: false, route };
  }

  const onmidimessage = (e) => route(e.data);
  const attachAll = () => {
    for (const input of access.inputs.values()) input.onmidimessage = onmidimessage;
  };
  attachAll();
  access.onstatechange = (e) => {
    attachAll();
    if (e.port && e.port.type === 'input' && e.port.state === 'connected') {
      handlers.onStatus?.('connected', e.port.name);
    }
  };

  const names = [...access.inputs.values()].map((i) => i.name);
  handlers.onStatus?.(names.length ? 'connected' : 'ready', names.join(', '));
  return { enabled: true, route, access };
}
