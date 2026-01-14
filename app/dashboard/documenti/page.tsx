"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/Sidebar";
import { FileText, Download, Eye, User, AlertCircle } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import PrivacyDocument from "@/components/pdfs/PrivacyDocument";
import DeliveryDocument from "@/components/pdfs/DeliveryDocument";

interface Paziente {
  id: number;
  nome: string;
  cognome: string;
  codice_fiscale: string;
  indirizzo?: string;
  citta?: string;
  data_nascita?: string;
  luogo_nascita?: string;
}

export default function DocumentiPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [pazienti, setPazienti] = useState<Paziente[]>([]);
  const [selectedPaziente, setSelectedPaziente] = useState<string>("");
  const [loadingPazienti, setLoadingPazienti] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Fetch Pazienti
  useEffect(() => {
    const fetchPazienti = async () => {
      try {
        const response = await fetch("/api/pazienti");
        const data = await response.json();
        if (data.success) {
          setPazienti(data.pazienti);
        }
      } catch (error) {
        console.error("Errore caricamento pazienti:", error);
      } finally {
        setLoadingPazienti(false);
      }
    };

    if (isAuthenticated) {
      fetchPazienti();
    }
  }, [isAuthenticated]);

  // Helper per generare il PDF
  const generatePdfBlob = async (
    paziente: Paziente,
    docId: number
  ): Promise<Blob | null> => {
    try {
      if (docId === 1) {
        return await pdf(
          <PrivacyDocument paziente={paziente} logoUrl="/logo_meding.png" />
        ).toBlob();
      } else if (docId === 2) {
        return await pdf(
          <DeliveryDocument paziente={paziente} logoUrl="/logo_meding.png" />
        ).toBlob();
      }
      return null;
    } catch (error) {
      console.error("Errore generazione PDF Blob:", error);
      return null;
    }
  };

  // Anteprima PDF
  const handlePreview = async (docId: number) => {
    setMessage(null);

    if (docId === 1 || docId === 2) {
      if (!selectedPaziente) {
        setMessage({
          type: "error",
          text: "Seleziona un paziente per visualizzare l'anteprima.",
        });
        return;
      }

      const paziente = pazienti.find(
        (p) => p.id === parseInt(selectedPaziente)
      );
      if (!paziente) return;

      try {
        setGeneratingPdf(true);
        const blob = await generatePdfBlob(paziente, docId);

        if (blob) {
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
        } else {
          setMessage({ type: "error", text: "Errore generazione anteprima." });
        }
      } catch (error) {
        console.error("Errore anteprima:", error);
      } finally {
        setGeneratingPdf(false);
      }
    } else {
      setMessage({
        type: "error",
        text: "Anteprima non disponibile per questo documento.",
      });
    }
  };

  // Download e Salvataggio
  const handleDownload = async (docId: number, title: string) => {
    setMessage(null);

    // Gestione documenti dinamici (1: Privacy, 2: Consegna)
    if (docId === 1 || docId === 2) {
      if (!selectedPaziente) {
        setMessage({
          type: "error",
          text: "Seleziona un paziente per generare il documento.",
        });
        return;
      }

      const paziente = pazienti.find(
        (p) => p.id === parseInt(selectedPaziente)
      );
      if (!paziente) return;

      try {
        setGeneratingPdf(true);

        // Genera il PDF
        const blob = await generatePdfBlob(paziente, docId);

        if (!blob) throw new Error("Blob nullo");

        // 1. Download Locale
        const url = URL.createObjectURL(blob);
        // Nome file diverso in base al tipo
        const prefix = docId === 1 ? "Privacy" : "Consegna_Dispositivi";
        const filename = `${prefix}_${paziente.cognome}_${paziente.nome}.pdf`;

        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 2. Salvataggio su Server
        const formData = new FormData();
        formData.append("file", blob, filename);
        formData.append("filename", filename);

        const saveResponse = await fetch("/api/documenti/salva", {
          method: "POST",
          body: formData,
        });

        if (saveResponse.ok) {
          setMessage({
            type: "success",
            text: "Documento scaricato e archiviato su server correttamente!",
          });
        } else {
          console.warn("Errore salvataggio server:", await saveResponse.text());
          setMessage({
            type: "success",
            text: "Documento scaricato (ma errore archiviazione server).",
          });
        }
      } catch (error) {
        console.error("Errore generazione PDF:", error);
        setMessage({
          type: "error",
          text: "Errore durante la generazione del PDF.",
        });
      } finally {
        setGeneratingPdf(false);
      }
    } else {
      // Placeholder per altri documenti
      setMessage({
        type: "error",
        text: "Download non ancora disponibile per questo documento.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        Caricamento...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Placeholder documents data
  const documents = [
    {
      id: 1,
      title: "Liberatoria Archiviazione Dati Sanitari",
      type: "PDF",
      date: new Date().toLocaleDateString("it-IT"),
      size: "Generato Dinamicamente",
    },
    {
      id: 2,
      title: "Modulo Consegna Dispositivi Monitoraggio",
      type: "PDF",
      date: new Date().toLocaleDateString("it-IT"),
      size: "220 KB",
    },
    {
      id: 3,
      title: "Manuale Utente LINKTOP",
      type: "PDF",
      date: "01/12/2025",
      size: "2.5 MB",
    },
    {
      id: 4,
      title: "Guida Rapida Installazione",
      type: "PDF",
      date: "10/01/2026",
      size: "1.2 MB",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Sidebar />

      <main className="ml-64 p-8 transition-all duration-300">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Documenti</h1>
          <p className="text-gray-400">
            Archivio documenti e guide utili per l'utilizzo del sistema.
          </p>
        </div>

        {/* Message Alert */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${
              message.type === "error"
                ? "bg-red-500/10 border-red-500/20 text-red-200"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-200"
            }`}
          >
            <AlertCircle className="w-5 h-5" />
            <p>{message.text}</p>
          </div>
        )}

        {/* Paziente Selector */}
        <div className="mb-8">
          <label className="block text-gray-400 mb-2 font-medium">
            Seleziona Paziente
          </label>
          <div className="relative max-w-xl">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-500" />
            </div>
            <select
              value={selectedPaziente}
              onChange={(e) => setSelectedPaziente(e.target.value)}
              className="block w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all appearance-none"
              disabled={loadingPazienti}
            >
              <option value="" className="bg-slate-800 text-gray-400">
                {loadingPazienti
                  ? "Caricamento pazienti..."
                  : "-- Seleziona un paziente --"}
              </option>
              {pazienti.map((paziente) => (
                <option
                  key={paziente.id}
                  value={paziente.id}
                  className="bg-slate-800"
                >
                  {paziente.cognome} {paziente.nome} - {paziente.codice_fiscale}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </div>
          </div>
        </div>

        {/* Documents List */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 text-gray-400 font-medium">
                    Nome Documento
                  </th>
                  <th className="p-4 text-gray-400 font-medium">Tipo</th>
                  <th className="p-4 text-gray-400 font-medium">Data</th>
                  <th className="p-4 text-gray-400 font-medium">Dimensione</th>
                  <th className="p-4 text-gray-400 font-medium text-right">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="text-white font-medium">
                          {doc.title}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-300">{doc.type}</td>
                    <td className="p-4 text-gray-300">{doc.date}</td>
                    <td className="p-4 text-gray-300">{doc.size}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
                          title="Visualizza Anteprima"
                          onClick={() => handlePreview(doc.id)}
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          className="p-2 hover:bg-white/10 rounded-lg text-emerald-400 hover:text-emerald-300 transition-colors"
                          title="Scarica e Archivia"
                          onClick={() => handleDownload(doc.id, doc.title)}
                          disabled={generatingPdf}
                        >
                          {generatingPdf && (doc.id === 1 || doc.id === 2) ? (
                            <span className="animate-spin">⏳</span>
                          ) : (
                            <Download className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
