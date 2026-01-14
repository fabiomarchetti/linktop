import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#10b981', // Emerald 500
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    width: 150,
  },
  companyInfo: {
    textAlign: 'right',
    fontSize: 9,
    color: '#374151',
  },
  companyName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#065f46', // Emerald 800
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 15,
  },
  text: {
    marginBottom: 8,
    textAlign: 'justify',
  },
  bold: {
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#bfbfbf',
    marginBottom: 20,
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#bfbfbf',
    minHeight: 25,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    fontWeight: 'bold',
  },
  tableColCheck: {
    width: '10%',
    borderRightWidth: 1,
    borderRightColor: '#bfbfbf',
    padding: 5,
    textAlign: 'center',
  },
  tableColDesc: {
    width: '60%',
    borderRightWidth: 1,
    borderRightColor: '#bfbfbf',
    padding: 5,
  },
  tableColSerial: {
    width: '30%',
    padding: 5,
  },
  footer: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: '#000',
    width: 200,
    textAlign: 'center',
    paddingTop: 5,
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 10,
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'grey',
  },
});

interface DeliveryDocumentProps {
  paziente: {
    nome: string;
    cognome: string;
    codice_fiscale: string;
    indirizzo?: string;
    citta?: string;
  };
  logoUrl?: string;
}

const DeliveryDocument: React.FC<DeliveryDocumentProps> = ({ paziente, logoUrl }) => {
  const currentDate = new Date().toLocaleDateString('it-IT');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {logoUrl ? (
              <Image src={logoUrl} />
            ) : (
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#10b981' }}>MEDING</Text>
            )}
          </View>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>MEDING GROUP S.R.L.</Text>
            <Text>Sede Legale: Via degli Abeti, 60</Text>
            <Text>64046 Montorio al Vomano (TE)</Text>
            <Text>P.IVA: 01756300677</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>VERBALE DI CONSEGNA DISPOSITIVI</Text>

        {/* User Info */}
        <View style={styles.section}>
          <Text style={styles.text}>
            Il sottoscritto <Text style={styles.bold}>{paziente.nome} {paziente.cognome}</Text>, 
            Codice Fiscale <Text style={styles.bold}>{paziente.codice_fiscale}</Text>,
            residente in <Text style={styles.bold}>{paziente.indirizzo || '________________'}, {paziente.citta || ''}</Text>,
          </Text>
          <Text style={styles.text}>
            dichiara di ricevere in data odierna, in comodato d'uso gratuito, i seguenti dispositivi medici per il monitoraggio sanitario remoto:
          </Text>
        </View>

        {/* Devices Table */}
        <View style={styles.table}>
          {/* Header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={styles.tableColCheck}>
              <Text>Q.tà</Text>
            </View>
            <View style={styles.tableColDesc}>
              <Text>Descrizione Dispositivo</Text>
            </View>
            <View style={styles.tableColSerial}>
              <Text>S/N (Seriale)</Text>
            </View>
          </View>

          {/* Row 1 */}
          <View style={styles.tableRow}>
            <View style={styles.tableColCheck}>
              <Text>1</Text>
            </View>
            <View style={styles.tableColDesc}>
              <Text>Health Monitor LINKTOP HC-03 (6-in-1)</Text>
              <Text style={{ fontSize: 9, color: 'grey' }}>(SpO2, ECG, Temp, Press, HR)</Text>
            </View>
            <View style={styles.tableColSerial}>
              <Text>________________</Text>
            </View>
          </View>

          {/* Row 2 */}
          <View style={styles.tableRow}>
            <View style={styles.tableColCheck}>
              <Text>1</Text>
            </View>
            <View style={styles.tableColDesc}>
              <Text>Stetoscopio Digitale LINKTOP</Text>
            </View>
            <View style={styles.tableColSerial}>
              <Text>________________</Text>
            </View>
          </View>

          {/* Row 3 */}
          <View style={styles.tableRow}>
            <View style={styles.tableColCheck}>
              <Text>1</Text>
            </View>
            <View style={styles.tableColDesc}>
              <Text>Otoscopio Digitale LINKTOP</Text>
            </View>
            <View style={styles.tableColSerial}>
              <Text>________________</Text>
            </View>
          </View>

           {/* Row 4 */}
           <View style={styles.tableRow}>
            <View style={styles.tableColCheck}>
              <Text></Text>
            </View>
            <View style={styles.tableColDesc}>
              <Text>Caricabatterie / Cavi USB</Text>
            </View>
            <View style={styles.tableColSerial}>
              <Text>-</Text>
            </View>
          </View>
        </View>

        {/* Conditions */}
        <View style={styles.section}>
          <Text style={styles.text}>
            L'utente si impegna a:
          </Text>
          <View style={{ marginLeft: 15 }}>
            <Text style={styles.text}>1. Custodire i dispositivi con la massima diligenza e cura.</Text>
            <Text style={styles.text}>2. Utilizzare i dispositivi esclusivamente per le finalità di monitoraggio sanitario previste.</Text>
            <Text style={styles.text}>3. Non cedere a terzi, manomettere o danneggiare i dispositivi.</Text>
            <Text style={styles.text}>4. Restituire i dispositivi al termine del periodo di monitoraggio o su richiesta di Meding Group S.r.l.</Text>
            <Text style={styles.text}>5. Comunicare tempestivamente eventuali malfunzionamenti o smarrimenti.</Text>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.footer}>
          <View>
            <Text>Luogo e data:</Text>
            <Text style={{ marginTop: 10 }}>________________, {currentDate}</Text>
          </View>
          <View>
            <Text style={styles.signatureBox}>Firma per ricevuta e accettazione</Text>
          </View>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `${pageNumber} / ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

export default DeliveryDocument;
