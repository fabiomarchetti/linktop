// lib/screens/contacts_screen.dart
// Contatti famiglia: da 1 a 4 contatti, configurabili dall'utente

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ContactsScreen extends StatefulWidget {
  const ContactsScreen({super.key});

  @override
  State<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends State<ContactsScreen> {
  static const String _prefsKey = 'family_contacts';

  List<Map<String, String>> _contacts = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadContacts();
  }

  Future<void> _loadContacts() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_prefsKey);
    if (stored != null) {
      final List decoded = jsonDecode(stored);
      _contacts = decoded.map((c) => Map<String, String>.from(c)).toList();
    }
    setState(() => _isLoading = false);
  }

  Future<void> _saveContacts() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, jsonEncode(_contacts));
  }

  void _makeCall(String number) {
    if (number.isEmpty) return;
    const platform = MethodChannel('app.channel.shared.data');
    platform.invokeMethod('makeCall', {'number': number});
  }

  void _addContact() {
    if (_contacts.length >= 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Massimo 4 contatti', style: TextStyle(fontSize: 18))),
      );
      return;
    }
    _showEditDialog(null);
  }

  void _editContact(int index) {
    _showEditDialog(index);
  }

  void _deleteContact(int index) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminare?', style: TextStyle(fontSize: 24)),
        content: Text(
          'Vuoi eliminare ${_contacts[index]['name']}?',
          style: const TextStyle(fontSize: 20),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('ANNULLA', style: TextStyle(fontSize: 18)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() => _contacts.removeAt(index));
              _saveContacts();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('ELIMINA', style: TextStyle(fontSize: 18)),
          ),
        ],
      ),
    );
  }

  void _showEditDialog(int? index) {
    final isNew = index == null;
    final nameCtrl = TextEditingController(
      text: isNew ? '' : _contacts[index!]['name'],
    );
    final phoneCtrl = TextEditingController(
      text: isNew ? '' : _contacts[index!]['phone'],
    );

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          isNew ? 'Nuovo contatto' : 'Modifica contatto',
          style: const TextStyle(fontSize: 24),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              textCapitalization: TextCapitalization.words,
              style: const TextStyle(fontSize: 22),
              decoration: InputDecoration(
                labelText: 'Nome',
                labelStyle: const TextStyle(fontSize: 18),
                hintText: 'es. Figlio, Medico',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: phoneCtrl,
              keyboardType: TextInputType.phone,
              style: const TextStyle(fontSize: 22),
              decoration: InputDecoration(
                labelText: 'Numero',
                labelStyle: const TextStyle(fontSize: 18),
                hintText: 'es. 3301234567',
                prefixIcon: const Icon(Icons.phone),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('ANNULLA', style: TextStyle(fontSize: 18)),
          ),
          ElevatedButton(
            onPressed: () {
              final name = nameCtrl.text.trim();
              final phone = phoneCtrl.text.trim();
              if (name.isEmpty || phone.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Inserisci nome e numero')),
                );
                return;
              }
              Navigator.pop(ctx);
              setState(() {
                if (isNew) {
                  _contacts.add({'name': name, 'phone': phone});
                } else {
                  _contacts[index!] = {'name': name, 'phone': phone};
                }
              });
              _saveContacts();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.blue,
              foregroundColor: Colors.white,
            ),
            child: const Text('SALVA', style: TextStyle(fontSize: 18)),
          ),
        ],
      ),
    );
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
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // Lista contatti
                  Expanded(
                    child: _contacts.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.people_outline, size: 80, color: Colors.grey[400]),
                                const SizedBox(height: 16),
                                const Text(
                                  'Nessun contatto',
                                  style: TextStyle(fontSize: 24, color: Colors.grey),
                                ),
                                const SizedBox(height: 8),
                                const Text(
                                  'Aggiungi i numeri della famiglia',
                                  style: TextStyle(fontSize: 16, color: Colors.grey),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            itemCount: _contacts.length,
                            itemBuilder: (context, index) {
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: _buildContactCard(index),
                              );
                            },
                          ),
                  ),

                  // Bottone AGGIUNGI
                  if (_contacts.length < 4) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      height: 70,
                      child: ElevatedButton.icon(
                        onPressed: _addContact,
                        icon: const Icon(Icons.person_add, size: 28),
                        label: const Text('AGGIUNGI CONTATTO',
                            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue[700],
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildContactCard(int index) {
    final contact = _contacts[index];
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      elevation: 3,
      child: InkWell(
        onTap: () => _makeCall(contact['phone']!),
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              // Icona
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: Colors.blue[100],
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Icon(Icons.person, size: 32, color: Colors.blue),
                ),
              ),
              const SizedBox(width: 14),
              // Nome + numero
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      contact['name']!.toUpperCase(),
                      style: const TextStyle(
                          fontSize: 22, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      contact['phone']!,
                      style: const TextStyle(fontSize: 16, color: Colors.grey),
                    ),
                  ],
                ),
              ),
              // Bottoni modifica + elimina
              IconButton(
                onPressed: () => _editContact(index),
                icon: const Icon(Icons.edit, color: Colors.blue, size: 24),
              ),
              IconButton(
                onPressed: () => _deleteContact(index),
                icon: const Icon(Icons.delete, color: Colors.red, size: 24),
              ),
              // Bottone chiama
              Container(
                width: 50,
                height: 50,
                decoration: const BoxDecoration(
                    color: Colors.green, shape: BoxShape.circle),
                child: const Icon(Icons.phone, color: Colors.white, size: 28),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
