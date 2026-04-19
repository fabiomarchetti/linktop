// lib/screens/video_call_screen.dart
// Schermata videochiamata JaaS — risposta automatica, a tutto schermo

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:jitsi_meet_flutter_sdk/jitsi_meet_flutter_sdk.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

class VideoCallScreen extends StatefulWidget {
  static _VideoCallScreenState? _activeState;
  static void forceEnd() => _activeState?._forceEnd();
  final String roomName;
  final String jwt;
  final String jaasAppId;
  final VoidCallback onCallEnded;

  const VideoCallScreen({
    super.key,
    required this.roomName,
    required this.jwt,
    required this.jaasAppId,
    required this.onCallEnded,
  });

  @override
  State<VideoCallScreen> createState() => _VideoCallScreenState();
}

class _VideoCallScreenState extends State<VideoCallScreen> {
  final _jitsi = JitsiMeet();
  bool _joining = false;
  int _countdown = 5;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    VideoCallScreen._activeState = this;
    WakelockPlus.enable();
    _startCountdown();
  }

  @override
  void dispose() {
    if (VideoCallScreen._activeState == this) VideoCallScreen._activeState = null;
    _countdownTimer?.cancel();
    WakelockPlus.disable();
    super.dispose();
  }

  void _forceEnd() {
    _jitsi.hangUp();
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) widget.onCallEnded();
    });
  }

  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() => _countdown--);
      if (_countdown <= 0) {
        t.cancel();
        _joinCall();
      }
    });
  }

  Future<void> _joinCall() async {
    if (_joining) return;
    setState(() => _joining = true);
    _countdownTimer?.cancel();

    final options = JitsiMeetConferenceOptions(
      serverURL: 'https://8x8.vc',
      room: '${widget.jaasAppId}/${widget.roomName}',
      token: widget.jwt,
      configOverrides: {
        'startWithAudioMuted': false,
        'startWithVideoMuted': false,
        'disableDeepLinking': true,
        'prejoinPageEnabled': false,
      },
      featureFlags: {
        'pip.enabled': false,
        'invite.enabled': false,
        'recording.enabled': false,
        'live-streaming.enabled': false,
        'meeting-name.enabled': false,
        'toolbox.alwaysVisible': false,
      },
    );

    final listener = JitsiMeetEventListener(
      conferenceTerminated: (url, error) {
        if (mounted) widget.onCallEnded();
      },
    );

    await _jitsi.join(options, listener);
    // Jitsi chiuso per qualsiasi motivo — torna all'app principale
    if (mounted) widget.onCallEnded();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.video_call, size: 80, color: Colors.green),
              const SizedBox(height: 24),
              const Text(
                'Chiamata in arrivo',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              if (!_joining)
                Text(
                  'Risposta automatica tra $_countdown secondi...',
                  style: const TextStyle(color: Colors.grey, fontSize: 18),
                ),
              const SizedBox(height: 40),
              if (!_joining)
                ElevatedButton.icon(
                  onPressed: _joinCall,
                  icon: const Icon(Icons.call, size: 28),
                  label: const Text('Rispondi ora',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(50)),
                  ),
                ),
              if (_joining)
                const CircularProgressIndicator(color: Colors.green),
            ],
          ),
        ),
      ),
    );
  }
}
