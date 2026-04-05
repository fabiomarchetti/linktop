// lib/screens/phone_screen.dart
// Tastierino telefono con numeri grandi per anziani

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class PhoneScreen extends StatefulWidget {
  const PhoneScreen({super.key});

  @override
  State<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends State<PhoneScreen> {
  String _phoneNumber = '';

  void _addDigit(String digit) {
    setState(() {
      _phoneNumber += digit;
    });
    // Feedback aptico
    HapticFeedback.lightImpact();
  }

  void _removeDigit() {
    if (_phoneNumber.isNotEmpty) {
      setState(() {
        _phoneNumber = _phoneNumber.substring(0, _phoneNumber.length - 1);
      });
    }
  }

  void _clearNumber() {
    setState(() {
      _phoneNumber = '';
    });
  }

  void _makeCall() {
    if (_phoneNumber.isNotEmpty) {
      const platform = MethodChannel('app.channel.shared.data');
      platform.invokeMethod('makeCall', {'number': _phoneNumber});
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: const Text('TELEFONO', style: TextStyle(fontSize: 28)),
        centerTitle: true,
        backgroundColor: Colors.green,
        foregroundColor: Colors.white,
        toolbarHeight: 70,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, size: 32),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Column(
        children: [
          // Display numero
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            margin: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(15),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 5,
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    _phoneNumber.isEmpty ? 'Inserisci numero' : _phoneNumber,
                    style: TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      color: _phoneNumber.isEmpty ? Colors.grey : Colors.black,
                      letterSpacing: 2,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
                if (_phoneNumber.isNotEmpty)
                  IconButton(
                    onPressed: _clearNumber,
                    icon: const Icon(Icons.clear, size: 32),
                    color: Colors.grey,
                  ),
              ],
            ),
          ),
          
          // Tastierino
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildDigitRow(['1', '2', '3']),
                  _buildDigitRow(['4', '5', '6']),
                  _buildDigitRow(['7', '8', '9']),
                  _buildDigitRow(['*', '0', '#']),
                ],
              ),
            ),
          ),
          
          // Bottoni azione
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Cancella
                Expanded(
                  child: SizedBox(
                    height: 80,
                    child: ElevatedButton(
                      onPressed: _removeDigit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.grey[300],
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                      child: const Icon(Icons.backspace, size: 36),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                // Chiama
                Expanded(
                  flex: 2,
                  child: SizedBox(
                    height: 80,
                    child: ElevatedButton(
                      onPressed: _phoneNumber.isNotEmpty ? _makeCall : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.phone, size: 36),
                          SizedBox(width: 10),
                          Text('CHIAMA', style: TextStyle(fontSize: 28)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDigitRow(List<String> digits) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: digits.map((digit) => _buildDigitButton(digit)).toList(),
    );
  }

  Widget _buildDigitButton(String digit) {
    return SizedBox(
      width: 90,
      height: 90,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(50),
        elevation: 2,
        child: InkWell(
          onTap: () => _addDigit(digit),
          borderRadius: BorderRadius.circular(50),
          child: Center(
            child: Text(
              digit,
              style: const TextStyle(
                fontSize: 40,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
