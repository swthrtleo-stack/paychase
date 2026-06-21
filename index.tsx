import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Platform, 
  Modal, 
  TextInput, 
  ScrollView,
  Animated
} from 'react-native';

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [invoices, setInvoices] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showGroupedModal, setShowGroupedModal] = useState(false);
  
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [parsedInvoices, setParsedInvoices] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(title + '\n\n' + message);
    } else {
      Alert.alert(title, message);
    }
  };

  const addInvoice = () => {
    if (!clientName || !amount || !dueDate) {
      showAlert('Missing Info', 'Please fill in client name, amount, and due date');
      return;
    }
    const newInvoice = {
      id: Date.now().toString(),
      clientName: clientName,
      clientPhone: clientPhone,
      amount: parseFloat(amount),
      dueDate: dueDate,
      status: 'Pending'
    };
    setInvoices([...invoices, newInvoice]);
    setClientName('');
    setClientPhone('');
    setAmount('');
    setDueDate('');
    setShowAddModal(false);
    showAlert('Success', 'Invoice added successfully!');
  };

  const getFutureDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const triggerFileUpload = () => {
    if (Platform.OS !== 'web') {
      showAlert('Not Supported', 'File upload is only available on web');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        setBulkText(text);
        parseFileData(text);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const parseFileData = (text) => {
    if (!text || !text.trim()) {
      showAlert('Empty File', 'The file appears to be empty');
      return;
    }
    const result = parseBulkData(text);
    if (result.invoices.length > 0) {
      setParsedInvoices(result.invoices);
      setParseErrors(result.errors);
      setShowPreviewModal(true);
    } else {
      showAlert('No Data Found', 'Could not parse any invoices.\n\nExpected: Name, Phone, Amount, Date');
    }
  };

  const getGroupedByCustomer = () => {
    const activeInvs = invoices.filter(inv => inv.status !== 'Paid');
    const groups = {};
    activeInvs.forEach(inv => {
      const key = inv.clientName;
      if (!groups[key]) {
        groups[key] = { clientName: inv.clientName, clientPhone: inv.clientPhone, invoices: [] };
      }
      groups[key].invoices.push(inv);
      if (!groups[key].clientPhone && inv.clientPhone) {
        groups[key].clientPhone = inv.clientPhone;
      }
    });
    return Object.values(groups).filter(g => g.invoices.length > 0);
  };

  const sendCombinedReminder = (group) => {
    if (!group.clientPhone) {
      showAlert('Missing Phone', 'No phone number for ' + group.clientName);
      return;
    }
    const totalAmount = group.invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const count = group.invoices.length;
    let message = 'Hi ' + group.clientName + ',\n\n';
    if (count === 1) {
      const inv = group.invoices[0];
      message += 'Reminder: Rs. ' + inv.amount.toLocaleString() + ' due on ' + inv.dueDate + '\n\n';
    } else {
      message += 'You have ' + count + ' pending invoices:\n\n';
      group.invoices.forEach((inv, index) => {
        message += (index + 1) + '. Rs. ' + inv.amount.toLocaleString() + ' (Due: ' + inv.dueDate + ')\n';
      });
      message += '\nTotal: Rs. ' + totalAmount.toLocaleString() + '\n\n';
    }
    message += 'Please process at your earliest convenience. Thanks!';
    const whatsappUrl = 'https://wa.me/' + group.clientPhone + '?text=' + encodeURIComponent(message);
    if (Platform.OS === 'web') {
      window.open(whatsappUrl, '_blank');
    }
  };

  const sendReminder = (invoice) => {
    if (!invoice.clientPhone) {
      showAlert('Missing Phone', 'Please add a phone number first');
      return;
    }
    const message = 'Hi ' + invoice.clientName + ', reminder: Rs. ' + invoice.amount.toLocaleString() + ' due on ' + invoice.dueDate + '. Thanks!';
    const whatsappUrl = 'https://wa.me/' + invoice.clientPhone + '?text=' + encodeURIComponent(message);
    if (Platform.OS === 'web') {
      window.open(whatsappUrl, '_blank');
    }
  };

  const parseBulkData = (text) => {
    if (!text || !text.trim()) return { invoices: [], errors: [] };
    const lines = text.trim().split('\n');
    const parsed = [];
    const errors = [];
    const startIndex = (lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('client')) ? 1 : 0;
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      let parts;
      if (line.includes('\t')) {
        parts = line.split('\t');
      } else if (line.includes(',')) {
        parts = line.split(',');
      } else {
        parts = line.split(/\s{2,}/);
      }
      parts = parts.map(p => p.trim()).filter(p => p);
      if (parts.length >= 3) {
        const name = parts[0];
        const phone = parts[1] || '';
        const amountStr = parts[2].replace(/[^0-9.]/g, '');
        const amt = parseFloat(amountStr);
        const date = parts[3] || getFutureDate(15);
        if (name && !isNaN(amt) && amt > 0) {
          parsed.push({
            id: Date.now().toString() + Math.random().toString(36) + i,
            clientName: name,
            clientPhone: phone,
            amount: amt,
            dueDate: date,
            status: 'Pending'
          });
        } else {
          errors.push('Row ' + (i + 1));
        }
      } else {
        errors.push('Row ' + (i + 1));
      }
    }
    return { invoices: parsed, errors: errors };
  };

  const previewImport = () => {
    const result = parseBulkData(bulkText);
    if (result.invoices.length === 0) {
      showAlert('Import Failed', 'Could not parse any invoices.\n\nExpected: Name, Phone, Amount, Date');
      return;
    }
    setParsedInvoices(result.invoices);
    setParseErrors(result.errors);
    setShowPreviewModal(true);
  };

  const confirmImport = () => {
    setInvoices([...invoices, ...parsedInvoices]);
    let message = 'Imported ' + parsedInvoices.length + ' invoice(s)!';
    if (parseErrors.length > 0) {
      message += '\n' + parseErrors.length + ' row(s) skipped.';
    }
    showAlert('Success', message);
    setBulkText('');
    setParsedInvoices([]);
    setParseErrors([]);
    setShowPreviewModal(false);
    setShowBulkModal(false);
  };

  const markAsPaid = (id) => {
    setInvoices(invoices.map(inv => inv.id === id ? { ...inv, status: 'Paid' } : inv));
  };

  const deleteInvoice = (id) => {
    setInvoices(invoices.filter(inv => inv.id !== id));
  };

  const activeInvoices = invoices.filter(inv => inv.status !== 'Paid');
  const paidInvoices = invoices.filter(inv => inv.status === 'Paid');
  const totalOutstanding = activeInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalCollected = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const groupedCustomers = getGroupedByCustomer();
  const multiInvoiceCustomers = groupedCustomers.filter(g => g.invoices.length > 1);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>PayChase</Text>
          <Text style={styles.appSubtitle}>Get paid faster</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {currentView === 'home' ? (
          <View>
            <View style={styles.heroCard}>
              <View style={styles.heroContent}>
                <Text style={styles.heroLabel}>Total Outstanding</Text>
                <Text style={styles.heroAmount}>Rs. {totalOutstanding.toLocaleString()}</Text>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>
                    {activeInvoices.length} Active Invoice{activeInvoices.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            </View>

            {multiInvoiceCustomers.length > 0 && (
              <TouchableOpacity style={styles.combinedBanner} onPress={() => setShowGroupedModal(true)}>
                <View style={styles.combinedBannerLeft}>
                  <View style={styles.combinedBannerIcon}>
                    <Text style={styles.combinedBannerIconText}>+</Text>
                  </View>
                  <View>
                    <Text style={styles.combinedBannerTitle}>Combined Reminders</Text>
                    <Text style={styles.combinedBannerSubtitle}>
                      {multiInvoiceCustomers.length} customer(s) with multiple invoices
                    </Text>
                  </View>
                </View>
                <Text style={styles.combinedBannerArrow}>{'>'}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Payments</Text>
              {activeInvoices.length > 0 && (
                <TouchableOpacity style={styles.bulkAddSmallBtn} onPress={() => setShowBulkModal(true)}>
                  <Text style={styles.bulkAddSmallText}>Bulk Import</Text>
                </TouchableOpacity>
              )}
            </View>

            {activeInvoices.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Text style={styles.emptyIconText}>+</Text>
                </View>
                <Text style={styles.emptyTitle}>No pending invoices</Text>
                <Text style={styles.emptyText}>Add your first invoice to get started</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.actionButtonPrimary} onPress={() => setShowAddModal(true)}>
                    <Text style={styles.actionButtonText}>+ Add Single</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButtonSecondary} onPress={() => setShowBulkModal(true)}>
                    <Text style={styles.actionButtonTextSecondary}>Upload File</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              activeInvoices.map(item => (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardLeft}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{item.clientName.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View>
                        <Text style={styles.cardTitle}>{item.clientName}</Text>
                        <Text style={styles.cardDate}>Due: {item.dueDate}</Text>
                      </View>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>Pending</Text>
                    </View>
                  </View>
                  <Text style={styles.cardAmount}>Rs. {item.amount.toLocaleString()}</Text>
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.reminderButton} onPress={() => sendReminder(item)}>
                      <Text style={styles.reminderButtonText}>Remind</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.successButton} onPress={() => markAsPaid(item.id)}>
                      <Text style={styles.successButtonText}>Paid</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteButton} onPress={() => deleteInvoice(item.id)}>
                      <Text style={styles.deleteButtonText}>X</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View>
            <View style={styles.heroCardGreen}>
              <View style={styles.heroContent}>
                <Text style={styles.heroLabel}>Total Collected</Text>
                <Text style={styles.heroAmount}>Rs. {totalCollected.toLocaleString()}</Text>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>
                    {paidInvoices.length} Invoice{paidInvoices.length !== 1 ? 's' : ''} Paid
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.sectionTitle}>Payment History</Text>
            {paidInvoices.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No payments yet</Text>
                <Text style={styles.emptyText}>Mark invoices as Paid to see them here</Text>
              </View>
            ) : (
              paidInvoices.map(item => (
                <View key={item.id} style={[styles.card, styles.paidCard]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardLeft}>
                      <View style={[styles.avatar, styles.avatarPaid]}>
                        <Text style={[styles.avatarText, styles.avatarTextPaid]}>V</Text>
                      </View>
                      <View>
                        <Text style={styles.cardTitle}>{item.clientName}</Text>
                        <Text style={styles.cardDate}>Due: {item.dueDate}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, styles.paidBadge]}>
                      <Text style={[styles.statusText, styles.paidText]}>Paid</Text>
                    </View>
                  </View>
                  <Text style={styles.cardAmount}>Rs. {item.amount.toLocaleString()}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navItem, currentView === 'home' && styles.navItemActive]} 
          onPress={() => setCurrentView('home')}
        >
          <Text style={[styles.navText, currentView === 'home' && styles.navTextActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.navItem, currentView === 'reports' && styles.navItemActive]} 
          onPress={() => setCurrentView('reports')}
        >
          <Text style={[styles.navText, currentView === 'reports' && styles.navTextActive]}>Reports</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Invoice</Text>
            <TextInput style={styles.input} placeholder="Client Name" value={clientName} onChangeText={setClientName} />
            <TextInput style={styles.input} placeholder="Phone (e.g., 919876543210)" value={clientPhone} onChangeText={setClientPhone} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Amount (Rs.)" value={amount} onChangeText={setAmount} keyboardType="numeric" />
            <Text style={styles.dateChipsLabel}>Quick Select Due Date:</Text>
            <View style={styles.dateChipsRow}>
              <TouchableOpacity style={styles.dateChip} onPress={() => setDueDate(getFutureDate(1))}>
                <Text style={styles.dateChipText}>Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateChip} onPress={() => setDueDate(getFutureDate(15))}>
                <Text style={styles.dateChipText}>Net 15</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateChip} onPress={() => setDueDate(getFutureDate(30))}>
                <Text style={styles.dateChipText}>Net 30</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="Or type custom due date..." value={dueDate} onChangeText={setDueDate} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setClientName(''); setClientPhone(''); setAmount(''); setDueDate(''); setShowAddModal(false); }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={addInvoice}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showBulkModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.bulkModal]}>
            <Text style={styles.modalTitle}>Bulk Import</Text>
            <Text style={styles.uploadLabel}>Option 1: Upload CSV File</Text>
            <TouchableOpacity style={styles.fileUploadButton} onPress={triggerFileUpload}>
              <Text style={styles.fileUploadText}>Choose CSV File</Text>
              <Text style={styles.fileUploadHint}>Excel: File then Save As then CSV</Text>
            </TouchableOpacity>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
            <Text style={styles.uploadLabel}>Option 2: Paste Data</Text>
            <TextInput style={[styles.input, styles.bulkInput]} placeholder="Paste data here..." multiline={true} numberOfLines={4} value={bulkText} onChangeText={setBulkText} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setBulkText(''); setShowBulkModal(false); }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={previewImport}>
                <Text style={styles.saveButtonText}>Preview Import</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPreviewModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.previewModal]}>
            <Text style={styles.modalTitle}>Preview Import</Text>
            <View style={styles.previewHeader}>
              <Text style={styles.previewCount}>{parsedInvoices.length} invoice(s)</Text>
              {parseErrors.length > 0 && (
                <Text style={styles.previewWarning}>{parseErrors.length} error(s)</Text>
              )}
            </View>
            <ScrollView style={styles.previewList}>
              {parsedInvoices.map((inv, index) => (
                <View key={index} style={styles.previewItem}>
                  <View style={styles.previewItemHeader}>
                    <Text style={styles.previewItemName}>{inv.clientName}</Text>
                    <Text style={styles.previewItemAmount}>Rs. {inv.amount.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.previewItemDetails}>Phone: {inv.clientPhone || 'N/A'} | Due: {inv.dueDate}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPreviewModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={confirmImport}>
                <Text style={styles.saveButtonText}>Confirm Import</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showGroupedModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.previewModal]}>
            <Text style={styles.modalTitle}>Combined Reminders</Text>
            <Text style={styles.groupedSubtitle}>Send all invoices for each customer in one message</Text>
            <ScrollView style={styles.previewList}>
              {groupedCustomers.map((group, index) => (
                <View key={index} style={[styles.groupedCard, group.invoices.length > 1 && styles.groupedCardMulti]}>
                  <View style={styles.groupedCardHeader}>
                    <View>
                      <Text style={styles.groupedName}>{group.clientName}</Text>
                      <Text style={styles.groupedPhone}>{group.clientPhone || 'No phone'}</Text>
                    </View>
                    <View style={[styles.groupedCountBadge, group.invoices.length > 1 && styles.groupedCountBadgeMulti]}>
                      <Text style={styles.groupedCountText}>{group.invoices.length} invoice(s)</Text>
                    </View>
                  </View>
                  <View style={styles.groupedInvoiceList}>
                    {group.invoices.map((inv, i) => (
                      <View key={i} style={styles.groupedInvoiceItem}>
                        <Text style={styles.groupedInvoiceAmount}>Rs. {inv.amount.toLocaleString()}</Text>
                        <Text style={styles.groupedInvoiceDate}>Due: {inv.dueDate}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.groupedTotal}>
                    <Text style={styles.groupedTotalLabel}>Total:</Text>
                    <Text style={styles.groupedTotalAmount}>Rs. {group.invoices.reduce((sum, inv) => sum + inv.amount, 0).toLocaleString()}</Text>
                  </View>
                  <TouchableOpacity style={[styles.groupedRemindButton, !group.clientPhone && styles.groupedRemindButtonDisabled]} onPress={() => sendCombinedReminder(group)}>
                    <Text style={styles.groupedRemindButtonText}>Send Combined Reminder</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowGroupedModal(false)}>
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  appName: { fontSize: 28, fontWeight: '800', color: '#4F46E5' },
  appSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  scrollView: { flex: 1, padding: 20, paddingBottom: 100 },
  heroCard: { backgroundColor: '#4F46E5', padding: 28, borderRadius: 20, marginBottom: 20 },
  heroCardGreen: { backgroundColor: '#059669', padding: 28, borderRadius: 20, marginBottom: 24 },
  heroContent: { flex: 1 },
  heroLabel: { color: '#C7D2FE', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  heroAmount: { color: '#FFFFFF', fontSize: 40, fontWeight: '800', marginVertical: 8 },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start', marginTop: 8 },
  heroBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  combinedBanner: { backgroundColor: '#EEF2FF', padding: 16, borderRadius: 16, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#C7D2FE' },
  combinedBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  combinedBannerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  combinedBannerIconText: { fontSize: 20, color: '#FFFFFF', fontWeight: '800' },
  combinedBannerTitle: { fontSize: 15, fontWeight: '700', color: '#4338CA' },
  combinedBannerSubtitle: { fontSize: 13, color: '#6366F1', marginTop: 2 },
  combinedBannerArrow: { fontSize: 20, color: '#6366F1', fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  bulkAddSmallBtn: { backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  bulkAddSmallText: { color: '#4F46E5', fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, marginBottom: 16 },
  paidCard: { borderLeftWidth: 4, borderLeftColor: '#059669' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarPaid: { backgroundColor: '#D1FAE5' },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#4F46E5' },
  avatarTextPaid: { color: '#059669' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  cardDate: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  statusBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  paidBadge: { backgroundColor: '#D1FAE5' },
  statusText: { color: '#92400E', fontSize: 12, fontWeight: '700' },
  paidText: { color: '#065F46' },
  cardAmount: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 16 },
  cardActions: { flexDirection: 'row', gap: 8 },
  reminderButton: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' },
  reminderButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  successButton: { backgroundColor: '#059669', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' },
  successButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  deleteButton: { backgroundColor: '#FEE2E2', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' },
  deleteButtonText: { color: '#DC2626', fontWeight: '700', fontSize: 13 },
  emptyState: { alignItems: 'center', marginTop: 40, padding: 20 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyIconText: { fontSize: 32, color: '#4F46E5', fontWeight: '800' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  actionRow: { flexDirection: 'row', width: '100%', gap: 12 },
  actionButtonPrimary: { flex: 1, backgroundColor: '#4F46E5', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  actionButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  actionButtonSecondary: { flex: 1, backgroundColor: '#FFFFFF', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: '#4F46E5' },
  actionButtonTextSecondary: { color: '#4F46E5', fontSize: 15, fontWeight: '700' },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  navItem: { alignItems: 'center', padding: 8 },
  navItemActive: { backgroundColor: '#EEF2FF', borderRadius: 12 },
  navText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  navTextActive: { color: '#4F46E5', fontWeight: '700' },
  fab: { position: 'absolute', bottom: 90, right: 24, backgroundColor: '#4F46E5', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  fabText: { color: '#FFFFFF', fontSize: 30, fontWeight: '300', marginTop: -4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#FFFFFF', width: '100%', padding: 28, borderRadius: 20, maxHeight: '85%' },
  bulkModal: { maxHeight: '90%' },
  previewModal: { maxHeight: '90%' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 16, textAlign: 'center' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', padding: 14, borderRadius: 12, marginBottom: 14, fontSize: 16, color: '#111827' },
  dateChipsLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' },
  dateChipsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  dateChip: { flex: 1, backgroundColor: '#EEF2FF', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginHorizontal: 4 },
  dateChipText: { color: '#4F46E5', fontWeight: '700', fontSize: 13 },
  bulkInput: { height: 100, textAlignVertical: 'top' },
  uploadLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 10, textTransform: 'uppercase' },
  fileUploadButton: { backgroundColor: '#F9FAFB', borderWidth: 2, borderColor: '#C7D2FE', borderStyle: 'dashed', padding: 24, borderRadius: 16, alignItems: 'center', marginBottom: 16 },
  fileUploadText: { fontSize: 15, fontWeight: '700', color: '#4F46E5', marginBottom: 4 },
  fileUploadHint: { fontSize: 12, color: '#9CA3AF' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { paddingHorizontal: 16, fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  previewCount: { backgroundColor: '#059669', color: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, fontSize: 13, fontWeight: '700' },
  previewWarning: { backgroundColor: '#FEF3C7', color: '#92400E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, fontSize: 13, fontWeight: '700' },
  previewList: { maxHeight: 350, marginBottom: 16 },
  previewItem: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#4F46E5' },
  previewItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  previewItemName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  previewItemAmount: { fontSize: 18, fontWeight: '800', color: '#4F46E5' },
  previewItemDetails: { fontSize: 13, color: '#6B7280' },
  groupedSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  groupedCard: { backgroundColor: '#F9FAFB', padding: 20, borderRadius: 16, marginBottom: 16 },
  groupedCardMulti: { borderLeftWidth: 4, borderLeftColor: '#4F46E5', backgroundColor: '#FFFFFF' },
  groupedCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  groupedName: { fontSize: 17, fontWeight: '700', color: '#111827' },
  groupedPhone: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  groupedCountBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  groupedCountBadgeMulti: { backgroundColor: '#EEF2FF' },
  groupedCountText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  groupedInvoiceList: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, marginBottom: 12 },
  groupedInvoiceItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  groupedInvoiceAmount: { fontSize: 14, fontWeight: '700', color: '#111827' },
  groupedInvoiceDate: { fontSize: 13, color: '#6B7280' },
  groupedTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingTop: 8 },
  groupedTotalLabel: { fontSize: 15, fontWeight: '700', color: '#374151' },
  groupedTotalAmount: { fontSize: 20, fontWeight: '800', color: '#4F46E5' },
  groupedRemindButton: { backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  groupedRemindButtonDisabled: { backgroundColor: '#E5E7EB' },
  groupedRemindButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, padding: 14, alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12 },
  cancelButtonText: { color: '#6B7280', fontWeight: '600', fontSize: 16 },
  saveButton: { flex: 1, backgroundColor: '#4F46E5', padding: 14, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});