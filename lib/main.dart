import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

// ==========================================
// 1. ENUM & DATA MODEL
// ==========================================
enum ApplicationStatus { pending, approved, rejected }

class InternshipApplication {
  final String id;
  final String studentName;
  final String companyName;
  final String position;
  final ApplicationStatus status;

  InternshipApplication({
    required this.id,
    required this.studentName,
    required this.companyName,
    required this.position,
    required this.status,
  });
}

// ==========================================
// 2. GOOGLE SHEETS SERVICE
// ==========================================
class SheetService {
  static const String webAppUrl =
      "https://script.google.com/macros/s/AKfycbx-zyxvKkFZ6yzn30tYGS6ZzUJvhbHPKEuiLHRLMDWMe3Mn80Gs2GkqCa5PELOYbBI7/exec";

  Future<List<InternshipApplication>> fetchApplications() async {
    try {
      final response = await http.get(Uri.parse(webAppUrl));
      if (response.statusCode == 200) {
        List<dynamic> rawList = jsonDecode(response.body);
        return rawList.map((item) {
          return InternshipApplication(
            id: item['id']?.toString() ?? '',
            studentName: item['studentName']?.toString() ?? 'ไม่ระบุชื่อ',
            companyName: item['companyName']?.toString() ?? 'ไม่ระบุบริษัท',
            position: item['position']?.toString() ?? 'ไม่ระบุตำแหน่ง',
            status: _parseStatus(item['status']?.toString()),
          );
        }).toList();
      }
      return [];
    } catch (e) {
      print("Error fetching: $e");
      return [];
    }
  }

  Future<bool> addApplication(InternshipApplication app) async {
    try {
      final Uri url = Uri.parse(webAppUrl).replace(
        queryParameters: {
          "action": "add",
          "id": app.id,
          "studentName": app.studentName,
          "companyName": app.companyName,
          "position": app.position,
          "startDate": DateTime.now().toIso8601String(),
          "endDate": DateTime.now()
              .add(const Duration(days: 90))
              .toIso8601String(),
          "status": "pending",
        },
      );

      final response = await http.get(url);
      return response.statusCode == 200;
    } catch (e) {
      print("Error adding: $e");
      return false;
    }
  }

  ApplicationStatus _parseStatus(String? statusText) {
    if (statusText == 'approved') return ApplicationStatus.approved;
    if (statusText == 'rejected') return ApplicationStatus.rejected;
    return ApplicationStatus.pending;
  }
}

// ==========================================
// 3. MAIN ENTRY POINT & THEME CONFIG
// ==========================================
void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Internship Portal',
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'Roboto',
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6C5CE7),
          primary: const Color(0xFF6C5CE7),
          secondary: const Color(0xFFFF7675),
          surface: const Color(0xFFF8F9FE),
        ),
        scaffoldBackgroundColor: const Color(0xFFF3F5FA),
      ),
      home: const InternshipListScreen(),
    );
  }
}

// ==========================================
// 4. LIST SCREEN (WITH LOGO & FIXED WARNINGS)
// ==========================================
class InternshipListScreen extends StatefulWidget {
  const InternshipListScreen({super.key});

  @override
  State<InternshipListScreen> createState() => _InternshipListScreenState();
}

class _InternshipListScreenState extends State<InternshipListScreen> {
  final SheetService _sheetService = SheetService();
  late Future<List<InternshipApplication>> _futureApplications;

  @override
  void initState() {
    super.initState();
    _refreshData();
  }

  void _refreshData() {
    setState(() {
      _futureApplications = _sheetService.fetchApplications();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // Vibrant Gradient Hero AppBar With Logo
          SliverAppBar(
            expandedHeight: 160.0,
            floating: false,
            pinned: true,
            elevation: 0,
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsets.only(left: 20, bottom: 16),
              title: Row(
                children: [
                  // Logo Icon Widget (สามารถเปลี่ยนเป็น Image.network / Image.asset ได้)
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.school_rounded,
                      color: Color(0xFF6C5CE7),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'รายการสมัครฝึกงาน',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Color(0xFF6C5CE7),
                      Color(0xFFA29BFE),
                      Color(0xFFFD79A8),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
            ),
            actions: [
              Container(
                margin: const EdgeInsets.only(right: 12),
                decoration: BoxDecoration(
                  // แก้ไขเป็น .withValues(alpha: 0.2)
                  color: Colors.white.withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                  onPressed: _refreshData,
                  tooltip: 'รีเฟรชข้อมูล',
                ),
              ),
            ],
          ),

          // List Body
          SliverToBoxAdapter(
            child: FutureBuilder<List<InternshipApplication>>(
              future: _futureApplications,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Padding(
                    padding: EdgeInsets.only(top: 100),
                    child: Center(
                      child: CircularProgressIndicator(
                        color: Color(0xFF6C5CE7),
                        strokeWidth: 3,
                      ),
                    ),
                  );
                }
                if (!snapshot.hasData || snapshot.data!.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.only(top: 80),
                    child: Column(
                      children: [
                        Icon(
                          Icons.folder_open_rounded,
                          size: 70,
                          color: Colors.grey.shade400,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'ยังไม่มีรายการสมัคร',
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.grey.shade600,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  );
                }

                final list = snapshot.data!;
                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  physics: const NeverScrollableScrollPhysics(),
                  shrinkWrap: true,
                  itemCount: list.length,
                  itemBuilder: (context, index) {
                    final item = list[index];
                    return _buildModernCard(item);
                  },
                );
              },
            ),
          ),
        ],
      ),

      // Glowing Action Button
      floatingActionButton: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(30),
          boxShadow: [
            BoxShadow(
              // แก้ไขเป็น .withValues(alpha: 0.4)
              color: const Color(0xFF6C5CE7).withValues(alpha: 0.4),
              blurRadius: 15,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: FloatingActionButton.extended(
          onPressed: () async {
            final result = await Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const AddApplicationScreen()),
            );
            if (result == true) {
              _refreshData();
            }
          },
          elevation: 0,
          label: const Text(
            'ยื่นสมัครฝึกงาน',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
          ),
          icon: const Icon(Icons.add_rounded, size: 22),
          backgroundColor: const Color(0xFF6C5CE7),
          foregroundColor: Colors.white,
        ),
      ),
    );
  }

  // Modern Card Design with Dynamic Colors
  Widget _buildModernCard(InternshipApplication item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            // แก้ไขเป็น .withValues(alpha: 0.04)
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF74B9FF), Color(0xFF0984E3)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Center(
                child: Text(
                  item.studentName.isNotEmpty
                      ? item.studentName[0].toUpperCase()
                      : 'U',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 20,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.studentName,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(
                        Icons.business_rounded,
                        size: 14,
                        color: Colors.grey,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          item.companyName,
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey.shade700,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(
                        Icons.work_outline_rounded,
                        size: 14,
                        color: Colors.grey,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          item.position,
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey.shade600,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _buildStatusBadge(item.status),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(ApplicationStatus status) {
    Color bg;
    Color text;
    String label;

    // แก้ไขสวิตช์และลบ default ที่ซ้ำซ้อนออก
    switch (status) {
      case ApplicationStatus.approved:
        bg = const Color(0xFFE8FADF);
        text = const Color(0xFF00B894);
        label = 'อนุมัติ';
        break;
      case ApplicationStatus.rejected:
        // แก้ไขเป็น .withValues(alpha: 0.5)
        bg = const Color(0xFFFFEAA7).withValues(alpha: 0.5);
        text = const Color(0xFFFF7675);
        label = 'ปฏิเสธ';
        break;
      case ApplicationStatus.pending:
        bg = const Color(0xFFE0F7FA);
        text = const Color(0xFF00CEC9);
        label = 'รอตรวจ';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: text,
          fontWeight: FontWeight.w800,
          fontSize: 12,
        ),
      ),
    );
  }
}

// ==========================================
// 5. FORM SCREEN (MODERN INPUT UI)
// ==========================================
class AddApplicationScreen extends StatefulWidget {
  const AddApplicationScreen({super.key});

  @override
  State<AddApplicationScreen> createState() => _AddApplicationScreenState();
}

class _AddApplicationScreenState extends State<AddApplicationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _companyController = TextEditingController();
  final _positionController = TextEditingController();
  final SheetService _sheetService = SheetService();
  bool _isLoading = false;

  void _submitForm() async {
    if (_formKey.currentState!.validate()) {
      setState(() => _isLoading = true);

      final newApp = InternshipApplication(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        studentName: _nameController.text,
        companyName: _companyController.text,
        position: _positionController.text,
        status: ApplicationStatus.pending,
      );

      bool success = await _sheetService.addApplication(newApp);

      setState(() => _isLoading = false);

      if (mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('ยื่นข้อมูลสำเร็จแล้ว!'),
              backgroundColor: const Color(0xFF00B894),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          );
          Navigator.pop(context, true);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('บันทึกไม่สำเร็จ โปรดลองอีกครั้ง'),
              backgroundColor: const Color(0xFFFF7675),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'ฟอร์มยื่นขอฝึกงาน',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: const Color(0xFF2D3436),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'กรอกข้อมูลของคุณ',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF2D3436),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'ข้อมูลจะถูกส่งเข้าสู่ระบบ Google Sheets โดยอัตโนมัติ',
                style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 28),
              _buildModernTextField(
                controller: _nameController,
                label: 'ชื่อ-นามสกุล นักศึกษา',
                icon: Icons.person_outline_rounded,
                validatorMsg: 'กรุณากรอกชื่อ-นามสกุล',
              ),
              const SizedBox(height: 18),
              _buildModernTextField(
                controller: _companyController,
                label: 'ชื่อบริษัท / หน่วยงาน',
                icon: Icons.business_outlined,
                validatorMsg: 'กรุณากรอกชื่อบริษัท',
              ),
              const SizedBox(height: 18),
              _buildModernTextField(
                controller: _positionController,
                label: 'ตำแหน่งงานที่สมัคร',
                icon: Icons.work_outline_rounded,
                validatorMsg: 'กรุณากรอกตำแหน่งงาน',
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 54,
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6C5CE7), Color(0xFFA29BFE)],
                    ),
                    boxShadow: [
                      BoxShadow(
                        // แก้ไขเป็น .withValues(alpha: 0.3)
                        color: const Color(0xFF6C5CE7).withValues(alpha: 0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    onPressed: _isLoading ? null : _submitForm,
                    child: _isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text(
                            'ส่งข้อมูลสมัคร',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildModernTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required String validatorMsg,
  }) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: const Color(0xFF6C5CE7)),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          vertical: 18,
          horizontal: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.grey.shade200),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFF6C5CE7), width: 2),
        ),
      ),
      validator: (value) =>
          value == null || value.isEmpty ? validatorMsg : null,
    );
  }
}
