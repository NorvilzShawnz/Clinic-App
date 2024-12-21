using Library.Clinic.Models;
using System.Linq;
using System.Collections.Generic;

namespace Library.Clinic.Services
{
    public class PhysicianServiceProxy
    {
        private static object _lock = new object();
        private static PhysicianServiceProxy? instance;

        public static PhysicianServiceProxy Current
        {
            get
            {
                lock (_lock)
                {
                    if (instance == null)
                    {
                        instance = new PhysicianServiceProxy();
                    }
                }
                return instance;
            }
        }

        private PhysicianServiceProxy()
        {
            Physicians = new List<Physician>
            {
                new Physician { License = "0615165126", Name = "John Doe", GraduationDate = DateTime.Now.AddYears(-5), Specializations = "Cardiology" },
                new Physician { License = "3120310", Name = "Jane Doe", GraduationDate = DateTime.Now.AddYears(-7), Specializations = "Dermatology" }
            };
        }

        private List<Physician> physicians;
        public List<Physician> Physicians
        {
            get => physicians;
            private set
            {
                if (physicians != value)
                {
                    physicians = value;
                }
            }
        }

        public int LastKey
        {
            get
            {
                // Generate a pseudo ID based on the current list's size
                if (Physicians.Any())
                {
                    return Physicians.Count;
                }
                return 0;
            }
        }

        public void AddOrUpdatePhysician(Physician physician)
        {
            var existingPhysician = Physicians.FirstOrDefault(p => p.License == physician.License);
            if (existingPhysician != null)
            {
                // Update existing physician
                existingPhysician.Name = physician.Name;
                existingPhysician.GraduationDate = physician.GraduationDate;
                existingPhysician.Specializations = physician.Specializations;
            }
            else
            {
                // Add new physician
                Physicians.Add(physician);
            }
        }

        public void DeletePhysician(string license)
        {
            var physicianToRemove = Physicians.FirstOrDefault(p => p.License == license);

            if (physicianToRemove != null)
            {
                Physicians.Remove(physicianToRemove);
            }
        }
    }
}
