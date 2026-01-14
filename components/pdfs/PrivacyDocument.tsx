import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register a standard font if needed, but default Helvetica is usually fine for basic docs.
// For better styling, we rely on standard fonts.

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
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 30,
    color: '#6b7280',
  },
  section: {
    marginBottom: 10,
  },
  text: {
    marginBottom: 8,
    textAlign: 'justify',
  },
  bold: {
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
  list: {
    marginLeft: 15,
    marginBottom: 10,
  },
  listItem: {
    marginBottom: 5,
    flexDirection: 'row',
  },
  bullet: {
    width: 15,
  },
  footer: {
    marginTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    marginTop: 40,
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

interface PrivacyDocumentProps {
  paziente: {
    nome: string;
    cognome: string;
    codice_fiscale: string;
    indirizzo?: string;
    citta?: string;
    data_nascita?: string;
    luogo_nascita?: string;
  };
  logoUrl?: string;
}

const PrivacyDocument: React.FC<PrivacyDocumentProps> = ({ paziente, logoUrl }) => {
  const currentDate = new Date().toLocaleDateString('it-IT');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {/* If logoUrl is provided, use it. Otherwise, use text placeholder */}
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
            <Text>Tel: 0735 383751</Text>
            <Text>Email: amministrazione@medinggroup.it</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          INFORMATIVA E CONSENSO AL TRATTAMENTO DEI DATI PERSONALI E SENSIBILI
        </Text>
        <Text style={styles.subtitle}>
          (ai sensi degli artt. 13 e 14 del Regolamento UE 2016/679 - GDPR)
        </Text>

        {/* Body */}
        <View style={styles.section}>
          <Text style={styles.text}>
            Il sottoscritto <Text style={styles.bold}>{paziente.nome} {paziente.cognome}</Text>, 
            nato a <Text style={styles.bold}>{paziente.luogo_nascita || '________________'}</Text> 
            il <Text style={styles.bold}>{paziente.data_nascita ? new Date(paziente.data_nascita).toLocaleDateString('it-IT') : '________________'}</Text>, 
            residente in <Text style={styles.bold}>{paziente.indirizzo || '________________'}, {paziente.citta || ''}</Text>, 
            Codice Fiscale <Text style={styles.bold}>{paziente.codice_fiscale}</Text>,
          </Text>
          
          <Text style={styles.text}>
            è informato che:
          </Text>

          <View style={styles.list}>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>a)</Text>
              <Text style={styles.text}>
                I suoi dati personali e sensibili (stato di salute, parametri vitali, cartelle cliniche, registrazioni audio/video) saranno trattati per la seguente finalità: <Text style={styles.bold}>archiviazione in database per gestione sanitaria e monitoraggio remoto tramite piattaforma LINKTOP.</Text>
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>b)</Text>
              <Text style={styles.text}>
                Modalità di trattamento: raccolta, registrazione, organizzazione, conservazione, consultazione, elaborazione, modificazione, selezione, estrazione, raffronto, utilizzo, interconnessione, blocco, comunicazione, cancellazione e distruzione dei dati. Il trattamento sarà effettuato sia con supporto cartaceo che con l'ausilio di strumenti elettronici, informatici e telematici, con logiche strettamente correlate alle finalità indicate e, comunque, in modo da garantire la sicurezza e la riservatezza dei dati stessi.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>c)</Text>
              <Text style={styles.text}>
                Conferimento dei dati: il conferimento dei dati è facoltativo. L'eventuale rifiuto di conferire i dati personali e sensibili comporta l'impossibilità di effettuare l'archiviazione e di usufruire dei servizi di monitoraggio sanitario.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>d)</Text>
              <Text style={styles.text}>
                Comunicazione dei dati: i dati potranno essere comunicati a soggetti determinati (collaboratori autorizzati, personale medico e paramedico, personale tecnico per la manutenzione del sistema) incaricati dal Titolare per lo svolgimento di attività strumentali o correlate alle finalità sopra indicate. I dati non saranno oggetto di diffusione indiscriminata.
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>e)</Text>
              <Text style={styles.text}>
                Titolare del trattamento: <Text style={styles.bold}>MEDING GROUP S.R.L.</Text>, con sede legale in Via degli Abeti, 60 - 64046 Montorio al Vomano (TE).
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>f)</Text>
              <Text style={styles.text}>
                Diritti dell'interessato: In ogni momento potrà esercitare i Suoi diritti nei confronti del Titolare del trattamento, ai sensi degli artt. 15-22 del Regolamento UE 2016/679 (accesso, rettifica, cancellazione, limitazione, portabilità, opposizione), rivolgendo richiesta scritta al Titolare all'indirizzo sopra indicato o via PEC a meding.group@legalmail.it.
              </Text>
            </View>
          </View>
        </View>

        {/* Consent Section */}
        <View style={[styles.section, { marginTop: 20, padding: 15, backgroundColor: '#f3f4f6' }]}>
          <Text style={[styles.title, { fontSize: 12, marginBottom: 15 }]}>CONSENSO</Text>
          <Text style={styles.text}>
            Il sottoscritto, letta l'informativa che precede,
          </Text>
          <Text style={[styles.text, { textAlign: 'center', marginVertical: 10, fontSize: 12 }]}>
            <Text style={styles.bold}>PRESTA IL CONSENSO</Text>
          </Text>
          <Text style={styles.text}>
            al trattamento dei propri dati personali e sensibili per le finalità e con le modalità sopra indicate.
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.footer}>
          <View>
            <Text>Luogo e data:</Text>
            <Text style={{ marginTop: 10 }}>________________, {currentDate}</Text>
          </View>
          <View>
            <Text style={styles.signatureBox}>Firma del Paziente</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `${pageNumber} / ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

export default PrivacyDocument;
