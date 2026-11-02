import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ScreenProps } from '../../Scripts/navigation/types';
import { useTheme } from '../../contexto/themeContext';
import { useAuth } from '../../contexto/authContext';
import { adminService, ExportEntity } from '../../Modules/admin/adminService';
import { exportRecordsToCsvFile } from '../../Modules/admin/csv';
import { Card, Button, StatusBanner, ScreenTopBar } from '../../Modules/components/index';

interface ReportOption {
  entity: ExportEntity;
  title: string;
  description: string;
}

const REPORTS: ReportOption[] = [
  { entity: 'users', title: 'USUARIOS', description: 'todas las cuentas registradas con su rol y estado.' },
  { entity: 'trainers', title: 'ENTRENADORES', description: 'cuentas con rol entrenador.' },
  { entity: 'members', title: 'SOCIOS', description: 'cuentas con rol socio.' },
  { entity: 'exercises', title: 'EJERCICIOS', description: 'catálogo global de ejercicios.' },
  { entity: 'routines', title: 'RUTINAS', description: 'rutinas creadas y su entrenador responsable.' },
  { entity: 'activity_logs', title: 'REGISTRO DE ACTIVIDAD', description: 'últimas 500 acciones registradas.' },
  { entity: 'incidents', title: 'INCIDENCIAS', description: 'incidencias del gimnasio y su estado.' }
];

export function ReportsExportScreen({ navigation }: ScreenProps<'ReportsExport'>) {
  const { colors } = useTheme();
  const { token } = useAuth();

  const [busyEntity, setBusyEntity] = useState<ExportEntity | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleExport = async (report: ReportOption) => {
    if (busyEntity) return;
    try {
      setBusyEntity(report.entity);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await adminService.getExportData(report.entity, token);
      const records = res?.data?.records || [];

      if (records.length === 0) {
        setErrorMessage(`no hay registros de ${report.title.toLowerCase()} disponibles para exportar`);
        return;
      }

      const { fileName, rowCount } = await exportRecordsToCsvFile(
        report.entity,
        records,
        report.title
      );

      setSuccessMessage(
        `archivo ${fileName} generado con éxito (${rowCount} ${rowCount === 1 ? 'registro' : 'registros'})`
      );
    } catch (error: any) {
      setErrorMessage(error?.message || `error al generar o compartir el archivo CSV de ${report.title.toLowerCase()}`);
    } finally {
      setBusyEntity(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenTopBar title="EXPORTAR INFORMES" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Cada informe se guarda como archivo .csv independiente en tu dispositivo con codificación UTF-8 y se abre el menú nativo para compartirlo o guardarlo.
        </Text>

        {errorMessage ? <StatusBanner message={errorMessage} type="error" /> : null}
        {successMessage ? <StatusBanner message={successMessage} type="success" /> : null}

        {REPORTS.map((report) => (
          <Card key={report.entity} style={styles.reportCard}>
            <Text style={[styles.reportTitle, { color: colors.text }]}>{report.title}</Text>
            <Text style={[styles.reportDesc, { color: colors.textSecondary }]}>{report.description}</Text>
            <Button
              title="GENERAR Y COMPARTIR CSV"
              variant="secondary"
              loading={busyEntity === report.entity}
              disabled={busyEntity !== null && busyEntity !== report.entity}
              onPress={() => handleExport(report)}
            />
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 36 },
  intro: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  reportCard: { padding: 14, marginVertical: 5 },
  reportTitle: { fontSize: 14, fontWeight: '800' },
  reportDesc: { fontSize: 12, lineHeight: 17, marginTop: 3, marginBottom: 8 }
});

export default ReportsExportScreen;
