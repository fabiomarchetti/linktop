// lib/screens/login_screen.dart
// Schermata di accesso paziente tramite Codice Fiscale

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback onLoginSuccess;

  const LoginScreen({super.key, required this.onLoginSuccess});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _cfController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _cfController.dispose();
    super.dispose();
  }

  Future<void> _verifyPatient() async {
    final cf = _cfController.text.trim().toUpperCase().replaceAll(' ', '');

    if (cf.isEmpty) {
      setState(() => _errorMessage = 'Inserisci il Codice Fiscale');
      return;
    }

    if (cf.length != 16) {
      setState(() => _errorMessage = 'Il Codice Fiscale deve avere 16 caratteri');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Password = prime 6 lettere del CF in minuscolo
      final letters = cf.replaceAll(RegExp(r'[^A-Za-z]'), '');
      final password = letters.length >= 6
          ? letters.substring(0, 6).toLowerCase()
          : letters.toLowerCase();

      final response = await http.post(
        Uri.parse('https://www.monitoraggiosalute.com/api/utente/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'codice_fiscale': cf,
          'password': password,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        // Paziente trovato — salva in locale
        final utente = data['utente'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('patient_id', utente['id'].toString());
        await prefs.setString('patient_name', '${utente['nome']} ${utente['cognome']}');
        await prefs.setString('codice_fiscale', cf);
        if (utente['emergenza_telefono'] != null) {
          await prefs.setString('emergenza_telefono', utente['emergenza_telefono']);
        }

        if (mounted) {
          widget.onLoginSuccess();
        }
      } else {
        setState(() {
          _errorMessage = null;
          _isLoading = false;
        });
        if (mounted) {
          _showNotFoundDialog();
        }
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Errore di connessione. Riprova.';
        _isLoading = false;
      });
    }
  }

  void _showNotFoundDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.warning_amber, color: Colors.orange, size: 36),
            SizedBox(width: 10),
            Expanded(
              child: Text('Utente non trovato',
                  style: TextStyle(fontSize: 22)),
            ),
          ],
        ),
        content: const Text(
          'Il Codice Fiscale inserito non risulta registrato.\n\n'
          'Contatta il supporto per verificare la registrazione:',
          style: TextStyle(fontSize: 18),
        ),
        actions: [
          // Email
          SizedBox(
            width: double.infinity,
            height: 60,
            child: ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                _sendSupportEmail();
              },
              icon: const Icon(Icons.email, size: 28),
              label: const Text('INVIA EMAIL', style: TextStyle(fontSize: 18)),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue,
                foregroundColor: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 10),
          // Telefono
          SizedBox(
            width: double.infinity,
            height: 60,
            child: ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                _callSupport();
              },
              icon: const Icon(Icons.phone, size: 28),
              label: const Text('CHIAMA SUPPORTO', style: TextStyle(fontSize: 18)),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                foregroundColor: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 10),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('CHIUDI', style: TextStyle(fontSize: 18)),
          ),
        ],
      ),
    );
  }

  void _sendSupportEmail() {
    // Apre il client email con il CF precompilato
    const platform = MethodChannel('app.channel.shared.data');
    platform.invokeMethod('sendEmail', {
      'to': 'marchettisoft@gmail.com',
      'subject': 'Verifica registrazione paziente',
      'body': 'Codice Fiscale: ${_cfController.text.trim().toUpperCase()}\n\n'
          'Si prega di verificare la registrazione.',
    });
  }

  void _callSupport() {
    const platform = MethodChannel('app.channel.shared.data');
    platform.invokeMethod('makeCall', {'number': '+393398063701'});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo / Titolo
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.blue,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.favorite,
                    size: 64,
                    color: Colors.white,
                  ),
                ),

                const SizedBox(height: 24),

                const Text(
                  'Monitoraggio Salute',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),

                const SizedBox(height: 8),

                const Text(
                  'Inserisci il tuo Codice Fiscale\nper accedere',
                  style: TextStyle(fontSize: 18, color: Colors.grey),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 40),

                // Campo Codice Fiscale
                TextField(
                  controller: _cfController,
                  textCapitalization: TextCapitalization.characters,
                  inputFormatters: [
                    FilteringTextInputFormatter.deny(RegExp(r'\s')),
                    LengthLimitingTextInputFormatter(16),
                    UpperCaseTextFormatter(),
                  ],
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 2,
                  ),
                  textAlign: TextAlign.center,
                  decoration: InputDecoration(
                    hintText: 'CODICE FISCALE',
                    hintStyle: const TextStyle(
                      fontSize: 20,
                      color: Colors.grey,
                      letterSpacing: 2,
                    ),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(15),
                      borderSide: BorderSide(color: Colors.grey[300]!),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(15),
                      borderSide: const BorderSide(color: Colors.blue, width: 2),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 20,
                    ),
                    suffixIcon: _cfController.text.isNotEmpty
                        ? IconButton(
                            onPressed: () {
                              _cfController.clear();
                              setState(() => _errorMessage = null);
                            },
                            icon: const Icon(Icons.clear, size: 28),
                          )
                        : null,
                  ),
                  onChanged: (_) => setState(() => _errorMessage = null),
                ),

                // Contatore caratteri
                Padding(
                  padding: const EdgeInsets.only(top: 8, right: 8),
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Text(
                      '${_cfController.text.length}/16',
                      style: TextStyle(
                        fontSize: 16,
                        color: _cfController.text.length == 16
                            ? Colors.green
                            : Colors.grey,
                      ),
                    ),
                  ),
                ),

                // Errore
                if (_errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red[50],
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.red),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error, color: Colors.red),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(
                                fontSize: 16,
                                color: Colors.red,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                const SizedBox(height: 30),

                // Bottone ACCEDI
                SizedBox(
                  width: double.infinity,
                  height: 70,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _verifyPatient,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                      ),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 30,
                            height: 30,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 3,
                            ),
                          )
                        : const Text(
                            'ACCEDI',
                            style: TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),

                const SizedBox(height: 30),

                // Link supporto
                const Divider(),
                const SizedBox(height: 10),
                const Text(
                  'Problemi di accesso?',
                  style: TextStyle(fontSize: 16, color: Colors.grey),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    TextButton.icon(
                      onPressed: _callSupport,
                      icon: const Icon(Icons.phone, size: 20),
                      label: const Text('Chiama', style: TextStyle(fontSize: 16)),
                    ),
                    const SizedBox(width: 16),
                    TextButton.icon(
                      onPressed: _sendSupportEmail,
                      icon: const Icon(Icons.email, size: 20),
                      label: const Text('Email', style: TextStyle(fontSize: 16)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Formatter per forzare maiuscole
class UpperCaseTextFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return TextEditingValue(
      text: newValue.text.toUpperCase(),
      selection: newValue.selection,
    );
  }
}
