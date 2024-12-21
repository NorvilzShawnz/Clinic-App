using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Library.Clinic.Models
{
    public class Physician
    {

        public override string ToString()
        {
            return $"[{License}] {Name}";
        }
        private string? name;
        public string Name
        {
            get
            {
                return name ?? string.Empty;
            }
            set
            {
                name = value;
            }
        }
        public DateTime GraduationDate { get; set; }
        public string License { get; set; }
        public string Specializations { get; set; }


        public Physician()
        {
            Name = string.Empty;
            GraduationDate = DateTime.MinValue;
            License = string.Empty;
            Specializations = string.Empty;
        }
    }
}
