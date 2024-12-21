using Library.Clinic.Models;
using Library.Clinic.Services;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Tasks;
namespace App.Clinic.ViewModels
{
    public class AppointmentManagementViewModel : INotifyPropertyChanged
    {

        public event PropertyChangedEventHandler? PropertyChanged;

        private void NotifyPropertyChanged([CallerMemberName] string propertyName = "")
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }

        public Appointment? SelectedAppointment { get; set; }
        private AppointmentServiceProxy _appSvc = AppointmentServiceProxy.Current;
        public ObservableCollection<AppointmentViewModel> Appointments
        {
            get
            {
                return new ObservableCollection<AppointmentViewModel>(
                    _appSvc.Appointments.Select(a => new AppointmentViewModel(a)));
            }
        }

        public void Delete()
        {
            if (SelectedAppointment == null)
            {
                return;
            }
            PatientServiceProxy.Current.DeletePatient(SelectedAppointment.Id);

            Refresh();
        }

        public void Refresh()
        {
            NotifyPropertyChanged(nameof(Appointments));
        }
    }
}
