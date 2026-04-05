// lib/screens/contacts_screen.dart
// Contatti famiglia con bottoni grandi per chiamata rapida

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class ContactsScreen extends StatelessWidget {
  const ContactsScreen({super.key});

  // Contatti preconfigurati (da caricare da Supabase in produzione)
  static const List<Map<String, String>> _contacts = [
    {'name': 'FIGLIO', 'phone': '+393398063701', 'icon': '👨'},
    {'name': 'FIGLIA', 'phone': '+393398063701', 'icon': '👩'},
    {'name': 'MEDICO', 'phone': '+393398063701', 'icon': '👨‍⚕️'},
    {'name': 'VICINA', 'phone': '+393398063701', 'icon': '👵'},
  ];

  void _makeCall(String number) {
    const platform = MethodChannel('app.channel.shared.data');
    platform.invokeMethod('makeCall', {'number': number});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: const Text('FAMIGLIA', style: TextStyle(fontSize: 28)),
        centerTitle: true,
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
        toolbarHeight: 70,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, size: 32),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            const Text(
              'Tocca per chiamare',
              style: TextStyle(fontSize: 20, color: Colors.grey),
            ),
            const SizedBox(height: 20),
            Expanded(
              child: ListView.builder(
                itemCount: _contacts.length,
                itemBuilder: (context, index) {
                  final contact = _contacts[index];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: _buildContactButton(contact),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContactButton(Map<String, String> contact) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      elevation: 3,
      child: InkWell(
        onTap: () => _makeCall(contact['phone']!),
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              // Avatar/Emoji
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: Colors.blue[100],
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    contact['icon']!,
                    style: const TextStyle(fontSize: 40),
                  ),
                ),
              ),
              const SizedBox(width: 20),
              // Nome
              Expanded(
                child: Text(
                  contact['name']!,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              // Icona telefono
              Container(
                width: 60,
                height: 60,
                decoration: const BoxDecoration(
                  color: Colors.green,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.phone,
                  color: Colors.white,
                  size: 32,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
