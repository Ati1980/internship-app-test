/**
 * ============================================================================
 * ระบบขอฝึกงาน - กลุ่มมิตรผล (Mitr Phol Internship Web App)
 * Backend Google Apps Script (Code.gs)
 * ============================================================================
 */

// รหัสโฟลเดอร์ Google Drive สำหรับเก็บไฟล์แนบ (ถ้าไม่ระบุ จะสร้างโฟลเดอร์ให้อัตโนมัติใน My Drive)
const UPLOAD_FOLDER_ID = ""; // เช่น "1A2B3C4D5E6F..." หรือปล่อยว่างไว้

/**
 * ============================================================================
 * Web App Routing
 * ============================================================================
 */
function doGet(e) {
  const page = String((e && e.parameter && e.parameter.page) || '').toLowerCase();

  if (page === 'user') {
    return HtmlService.createTemplateFromFile('User')
      .evaluate()
      .setTitle('Mitrphol Internship - User')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  if (page === 'admin') {
    return HtmlService.createTemplateFromFile('Admin')
      .evaluate()
      .setTitle('Mitrphol Internship - Admin')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('ระบบขอฝึกงาน - กลุ่มมิตรผล')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * ============================================================================
 * Student Application Submission Function
 * ============================================================================
 */
function processForm(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('ข้อมูลผู้สมัคร') || ss.getSheetByName('Applications');
    
    // หากยังไม่มีชีต ให้สร้างและใส่ Header คอลัมน์ให้ตรงตามโครงสร้าง
    if (!sheet) {
      sheet = ss.insertSheet('ข้อมูลผู้สมัคร');
      sheet.appendRow([
        'ประทับเวลา', 'สถานที่สมัคร', 'ชื่อ-สกุล', 'ชื่อเล่น', 'เบอร์โทรศัพท์', 'Line ID',
        'E-mail ตอบกลับนักศึกษา', 'E-mail ตอบกลับสถาบัน', 'ที่อยู่ตามทะเบียนบ้าน', 'วุฒิการศึกษา',
        'สถาบันการศึกษา', 'สาขา', 'วันเริ่มต้น', 'วันสิ้นสุด', 'หน่วยงานที่ต้องการฝึกงาน',
        'ความสามารถพิเศษ', 'ชื่อผู้ติดต่อฉุกเฉิน', 'เบอร์ผู้ติดต่อฉุกเฉิน', 'Profile',
        'เอกสารแนบ', 'สถานะ', 'ผู้พิจารณา', 'วันที่พิจารณา'
      ]);
    }

    // กำหนดโฟลเดอร์สำหรับอัปโหลดไฟล์
    let parentFolder;
    if (UPLOAD_FOLDER_ID && UPLOAD_FOLDER_ID.trim() !== '') {
      try {
        parentFolder = DriveApp.getFolderById(UPLOAD_FOLDER_ID.trim());
      } catch (fErr) {
        parentFolder = getOrCreateUploadFolder('MitrPhol_Internship_Uploads');
      }
    } else {
      parentFolder = getOrCreateUploadFolder('MitrPhol_Internship_Uploads');
    }

    // สร้างโฟลเดอร์ย่อยเฉพาะของผู้สมัครคนนี้ (ชื่อ-สกุล_เวลา)
    const timeStampStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const safeApplicantName = (data.fullName || 'Applicant').replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
    const applicantFolder = parentFolder.createFolder(`${safeApplicantName}_${timeStampStr}`);
    applicantFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // 1. จัดการรูป Profile
    let profileImageUrl = '';
    if (data.profileImage && data.profileImage.base64) {
      try {
        const pFile = saveBase64File(applicantFolder, data.profileImage.name || 'Profile_Image.jpg', data.profileImage.base64);
        if (pFile) {
          profileImageUrl = pFile.getUrl();
        }
      } catch (pErr) {
        Logger.log('Error saving profile image: ' + pErr.toString());
      }
    }

    // 2. จัดการไฟล์เอกสารแนบ (Resume, Transcript, IDCard, etc.)
    const fileLinksList = [];
    if (data.filesMap && typeof data.filesMap === 'object') {
      const labelMap = {
        'Resume': 'Resume',
        'Transcript': 'Transcript',
        'IDCard': 'IDCard',
        'RequestLetter': 'RequestLetter',
        'Other': 'Other'
      };

      for (const key in data.filesMap) {
        const item = data.filesMap[key];
        if (item && item.base64) {
          try {
            const uploadedFile = saveBase64File(applicantFolder, item.name || `${key}_Document`, item.base64);
            if (uploadedFile) {
              const label = labelMap[key] || key;
              fileLinksList.push(`${label}: ${uploadedFile.getUrl()}`);
            }
          } catch (fileErr) {
            Logger.log(`Error saving file ${key}: ` + fileErr.toString());
          }
        }
      }
    }
    const fileLinksString = fileLinksList.join('\n');

    // 3. บันทึกลงแถวใหม่ใน Sheet ข้อมูลผู้สมัคร (23 คอลัมน์ A-W)
    const now = new Date();
    const newRow = [
      now,                                      // A: ประทับเวลา
      String(data.location || '').trim(),       // B: สถานที่สมัคร
      String(data.fullName || '').trim(),       // C: ชื่อ-สกุล
      String(data.nickName || '').trim(),       // D: ชื่อเล่น
      String(data.phone || '').trim(),          // E: เบอร์โทรศัพท์
      String(data.lineId || '').trim(),         // F: Line ID
      String(data.emailStudent || '').trim(),   // G: E-mail ตอบกลับนักศึกษา
      String(data.emailInst || '').trim(),      // H: E-mail ตอบกลับสถาบัน
      String(data.address || '').trim(),        // I: ที่อยู่ตามทะเบียนบ้าน
      String(data.degree || '').trim(),         // J: วุฒิการศึกษา
      String(data.institution || '').trim(),    // K: สถาบันการศึกษา
      String(data.major || '').trim(),          // L: สาขา
      data.startDate || '',                     // M: วันเริ่มต้น
      data.endDate || '',                       // N: วันสิ้นสุด
      String(data.workUnit || '').trim(),       // O: หน่วยงานที่ต้องการฝึกงาน
      String(data.skills || '').trim(),         // P: ความสามารถพิเศษ
      String(data.emergencyName || '').trim(),   // Q: ชื่อผู้ติดต่อฉุกเฉิน
      String(data.emergencyPhone || '').trim(),  // R: เบอร์ผู้ติดต่อฉุกเฉิน
      profileImageUrl,                          // S: Profile Image URL
      fileLinksString,                          // T: เอกสารแนบ
      'unassigned',                             // U: สถานะ (เริ่มต้น unassigned)
      '-',                                      // V: ผู้พิจารณา
      ''                                        // W: วันที่พิจารณา
    ];

    sheet.appendRow(newRow);

    return {
      success: true,
      message: 'ส่งข้อมูลการสมัครฝึกงานเรียบร้อยแล้ว'
    };

  } catch (error) {
    Logger.log('Error in processForm: ' + error.toString());
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.toString()
    };
  }
}

/**
 * ============================================================================
 * Authentication Functions
 * ============================================================================
 */

/**
 * ตรวจสอบการเข้าสู่ระบบสำหรับ USER และ ADMIN
 * อ้างอิงโครงสร้างคอลัมน์ของชีต 'User':
 * Col A (index 0): รหัสพนักงาน
 * Col B (index 1): คำนำหน้า (นาย / น.ส. / นาง)
 * Col C (index 2): ชื่อ
 * Col D (index 3): นามสกุล
 * Col E (index 4): ชื่อตำแหน่ง
 * Col F (index 5): ฝ่าย
 * Col G (index 6): ด้าน
 * Col H (index 7): สายงาน
 * Col I (index 8): แผนก
 * Col K (index 10): Email (เช่น ATIWIT.L@MITRPHOL.COM)
 * Col P (index 15): Role ('Admin' หรือ 'User')
 */
function checkCompanyLogin(username, password) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('User') || ss.getSheetByName('CompanyUsers');
    if (!sheet) return { success: false, message: 'ไม่พบชีตผู้ใช้งาน (User)' };

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: false, message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' };

    const cleanInputUser = String(username || '').trim().toLowerCase();
    const cleanNormalizedUser = cleanInputUser.replace(/[\._-]/g, '');

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // ดึงรหัสพนักงาน จาก Col A (index 0)
      const empId = String(row[0] || '').trim();

      // ดึง Email จาก Col K (index 10)
      const dbEmail = String(row[10] || '').trim().toLowerCase();
      const emailPrefix = dbEmail.split('@')[0]; // เช่น "atiwit.l"
      const normalizedPrefix = emailPrefix.replace(/[\._-]/g, ''); // เช่น "atiwitl"
      
      // ดึง Role จาก Col P (index 15)
      const role = String(row[15] || 'user').trim().toLowerCase();

      // ชื่อ-สกุล และ ตำแหน่ง
      const title = String(row[1] || '').trim();
      const firstName = String(row[2] || '').trim();
      const lastName = String(row[3] || '').trim();
      const fullName = (firstName || lastName) ? `${title} ${firstName} ${lastName}`.trim() : (empId || emailPrefix.toUpperCase());
      const position = String(row[4] || '').trim(); // Col E: ชื่อตำแหน่ง
      const department = String(row[5] || '').trim(); // Col F: ฝ่าย
      const workUnit = String(row[8] || row[6] || '').trim(); // Col I หรือ G: แผนก

      // ตรวจสอบ Username เทียบกับ Email เต็ม, Email Prefix, Normalized Prefix หรือ รหัสพนักงาน
      if (
        cleanInputUser === dbEmail ||
        cleanInputUser === emailPrefix.toLowerCase() ||
        cleanNormalizedUser === normalizedPrefix ||
        cleanInputUser === empId.toLowerCase()
      ) {
        return {
          success: true,
          user: {
            id: empId,
            username: emailPrefix.toUpperCase(),
            fullName: fullName,
            position: position || 'เจ้าหน้าที่',
            department: department,
            companyName: department || 'กลุ่มมิตรผล',
            email: row[10] || '',
            role: role, // 'admin' หรือ 'user'
            loginMode: role === 'admin' ? 'admin' : 'user'
          }
        };
      }
    }

    return { success: false, message: 'ชื่อผู้ใช้ไม่ถูกต้อง หรือไม่พบในชีต User' };
  } catch (error) {
    return { success: false, message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์: ' + error.toString() };
  }
}

/**
 * ดึงข้อมูลผู้ใช้ปัจจุบันตาม User ID (รหัสพนักงาน หรือ Username)
 */
function getCurrentUserInfo(userId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('User') || ss.getSheetByName('CompanyUsers');
    if (!sheet) return { success: false, message: 'ไม่พบชีตผู้ใช้งาน' };

    const data = sheet.getDataRange().getValues();
    const cleanUserId = String(userId || '').trim().toLowerCase();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const empId = String(row[0] || '').trim().toLowerCase();
      const dbEmail = String(row[10] || '').trim().toLowerCase();
      const emailPrefix = dbEmail.split('@')[0].toLowerCase();

      if (cleanUserId === empId || cleanUserId === emailPrefix || cleanUserId === dbEmail) {
        const title = String(row[1] || '').trim();
        const firstName = String(row[2] || '').trim();
        const lastName = String(row[3] || '').trim();
        const fullName = (firstName || lastName) ? `${title} ${firstName} ${lastName}`.trim() : (row[0] || emailPrefix.toUpperCase());

        return {
          success: true,
          user: {
            id: row[0],
            username: emailPrefix.toUpperCase(),
            fullName: fullName,
            position: String(row[4] || 'เจ้าหน้าที่').trim(),
            department: String(row[5] || '').trim(),
            companyName: String(row[5] || 'กลุ่มมิตรผล').trim(),
            email: row[10] || dbEmail,
            role: String(row[15] || 'user').trim().toLowerCase()
          }
        };
      }
    }
    return { success: false, message: 'ไม่พบข้อมูลผู้ใช้งาน' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * ============================================================================
 * Applications Data Functions
 * ============================================================================
 */

/**
 * ดึงรายการผู้สมัครทั้งหมดสำหรับ Admin & User
 */
function getApplicationsList(username) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('ข้อมูลผู้สมัคร') || ss.getSheetByName('Applications');
    if (!sheet || sheet.getLastRow() <= 1) return [];

    username = String(username || '').trim().toLowerCase();

    var lastRow = sheet.getLastRow();
    var maxCols = Math.max(sheet.getLastColumn(), 23);
    var data = sheet.getRange(2, 1, lastRow - 1, maxCols).getValues();
    var result = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];

      // ข้ามแถวที่ไม่มีข้อมูล
      if (!row[2] && !row[6] && !row[4]) continue;

      var status = String(row[20] || 'unassigned').trim().toLowerCase();
      var reviewer = String(row[21] || '').trim();

      var rawProfileUrl = String(row[18] || '').trim();
      var directProfileUrl = formatDriveImageUrl(rawProfileUrl);

      result.push({
        id: i + 1,
        sheetRow: i + 2,
        timestamp: (row[0] instanceof Date) ? Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : String(row[0] || ''),
        location: String(row[1] || ''),
        fullName: String(row[2] || ''),
        nickName: String(row[3] || ''),
        phone: String(row[4] || ''),
        lineId: String(row[5] || ''),
        emailStudent: String(row[6] || ''),
        emailInst: String(row[7] || ''),
        address: String(row[8] || ''),
        degree: String(row[9] || ''),
        institution: String(row[10] || ''),
        major: String(row[11] || ''),
        startDate: (row[12] instanceof Date) ? formatDate(row[12]) : String(row[12] || ''),
        endDate: (row[13] instanceof Date) ? formatDate(row[13]) : String(row[13] || ''),
        workUnit: String(row[14] || ''),
        skills: String(row[15] || ''),
        emergencyName: String(row[16] || ''),
        emergencyPhone: String(row[17] || ''),
        profileImageLink: directProfileUrl,
        fileLinks: String(row[19] || ''),
        reviewStatus: status || 'unassigned',
        reviewerUsername: (reviewer === '-' || reviewer.toLowerCase() === 'null') ? '' : reviewer,
        reviewedAt: (row[22] instanceof Date) ? Utilities.formatDate(row[22], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : String(row[22] || '')
      });
    }

    return result.reverse();
  } catch (error) {
    throw new Error('เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
  }
}

/**
 * กดรับเรื่องใบสมัคร (Claim Application)
 */
function claimApplication(rowId, reviewerName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('ข้อมูลผู้สมัคร') || ss.getSheetByName('Applications');
    if (!sheet) return { success: false, message: 'ไม่พบชีตข้อมูล' };

    const currentReviewer = sheet.getRange(rowId, 22).getValue();
    if (currentReviewer && String(currentReviewer).trim() !== '' && String(currentReviewer).trim() !== '-') {
      return { success: false, message: 'ใบสมัครนี้มีผู้รับเรื่องแล้ว: ' + currentReviewer };
    }

    sheet.getRange(rowId, 21).setValue('pending');
    sheet.getRange(rowId, 22).setValue(reviewerName);
    sheet.getRange(rowId, 23).setValue(new Date());

    // บันทึกประวัติลงชีต "ประวัติการเลือก" (ถ้ามี)
    logActionHistory('Claim', rowId, reviewerName, 'รอการพิจารณา (pending)');

    return { success: true, message: 'รับเรื่องเรียบร้อยแล้ว' };
  } catch (error) {
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + error.toString() };
  }
}

/**
 * ทำเครื่องหมายว่าพิจารณาแล้ว / อนุมัติผล (Reviewed / Approved)
 */
function markApplicationReviewed(rowId, reviewerName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('ข้อมูลผู้สมัคร') || ss.getSheetByName('Applications');
    if (!sheet) return { success: false, message: 'ไม่พบชีตข้อมูล' };

    sheet.getRange(rowId, 21).setValue('reviewed');
    sheet.getRange(rowId, 22).setValue(reviewerName);
    sheet.getRange(rowId, 23).setValue(new Date());

    // บันทึกประวัติลงชีต "ประวัติการเลือก"
    logActionHistory('Approve', rowId, reviewerName, 'พิจารณาแล้ว (reviewed)');

    return { success: true, message: 'บันทึกสถานะพิจารณาแล้วเรียบร้อย' };
  } catch (error) {
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + error.toString() };
  }
}

/**
 * ยกเลิกการอนุมัติ / คืนสถานะใบสมัคร
 */
function cancelApplicationApproval(rowId, targetStatus) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('ข้อมูลผู้สมัคร') || ss.getSheetByName('Applications');
    if (!sheet) return { success: false, message: 'ไม่พบชีตข้อมูล' };

    const newStatus = targetStatus || 'unassigned';
    sheet.getRange(rowId, 21).setValue(newStatus);
    if (newStatus === 'unassigned') {
      sheet.getRange(rowId, 22).setValue('-');
    }
    sheet.getRange(rowId, 23).setValue('');

    // บันทึกประวัติลงชีต "ประวัติการเลือก"
    logActionHistory('Cancel', rowId, '-', `เปลี่ยนสถานะเป็น ${newStatus}`);

    return { success: true, message: 'อัปเดตสถานะเรียบร้อยแล้ว' };
  } catch (error) {
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + error.toString() };
  }
}

/**
 * เปลี่ยนตัวผู้รับเรื่องใบสมัคร
 */
function updateApplicationReviewer(rowId, newReviewerName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('ข้อมูลผู้สมัคร') || ss.getSheetByName('Applications');
    if (!sheet) return { success: false, message: 'ไม่พบชีตข้อมูล' };

    sheet.getRange(rowId, 22).setValue(newReviewerName);
    sheet.getRange(rowId, 23).setValue(new Date());

    // บันทึกประวัติลงชีต "ประวัติการเลือก"
    logActionHistory('UpdateReviewer', rowId, newReviewerName, 'เปลี่ยนผู้พิจารณา');

    return { success: true, message: 'เปลี่ยนผู้รับเรื่องเรียบร้อยแล้ว' };
  } catch (error) {
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + error.toString() };
  }
}

/**
 * บันทึก log การกระทำลงในชีต 'ประวัติการเลือก'
 */
function logActionHistory(action, rowId, operator, note) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let historySheet = ss.getSheetByName('ประวัติการเลือก');
    if (!historySheet) {
      historySheet = ss.insertSheet('ประวัติการเลือก');
      historySheet.appendRow(['ประทับเวลา', 'การกระทำ', 'แถวข้อมูล (Row)', 'ผู้ดำเนินการ', 'หมายเหตุ']);
    }
    historySheet.appendRow([new Date(), action, rowId, operator, note]);
  } catch (e) {
    Logger.log('Log action error: ' + e.toString());
  }
}

/**
 * ============================================================================
 * Helper Functions
 * ============================================================================
 */

/**
 * แปลง Base64 String และบันทึกเป็นไฟล์ใน Google Drive
 */
function saveBase64File(folder, fileName, base64Data) {
  const parts = base64Data.split(',');
  const contentType = parts[0].split(':')[1].split(';')[0];
  const decodedData = Utilities.base64Decode(parts[1]);
  const blob = Utilities.newBlob(decodedData, contentType, fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file;
}

/**
 * ค้นหาหรือสร้างโฟลเดอร์สำหรับเก็บไฟล์ใน Google Drive
 */
function getOrCreateUploadFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  const newFolder = DriveApp.createFolder(folderName);
  newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return newFolder;
}

/**
 * จัดรูปแบบ Drive Image URL ให้สามารถแสดงภาพในแท็ก img ได้โดยตรง
 */
function formatDriveImageUrl(url) {
  if (!url) return '';
  const urlStr = String(url);
  let fileId = '';
  
  const matchD = urlStr.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD && matchD[1]) {
    fileId = matchD[1];
  } else {
    const matchId = urlStr.match(/id=([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1]) {
      fileId = matchId[1];
    } else {
      const matchAny = urlStr.match(/[-\w]{25,}/);
      if (matchAny) fileId = matchAny[0];
    }
  }

  if (fileId) {
    return 'https://lh3.googleusercontent.com/d/' + fileId;
  }
  return urlStr;
}

/**
 * แปลง Date Object เป็นข้อความวันที่ dd/MM/yyyy
 */
function formatDate(dateObj) {
  if (!dateObj) return '-';
  if (!(dateObj instanceof Date)) {
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return String(dateObj);
    dateObj = d;
  }
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * ดึง Web App URL ปัจจุบัน
 */
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}
